/**
 * The production request handler: everything `server.bun.ts` serves, as a
 * plain `fetch`-style function with no side effects at import, so tests can
 * build one against a fixture directory and a fake Expo handler.
 *
 * Per request, in order:
 *
 * 1. `OPTIONS` is answered here — a CORS preflight for `/api` paths
 *    (`server/api/shared/cors.ts`), a bare 204 elsewhere.
 * 2. `/api` requests pass through the rate limiters (`server/rateLimits.js`),
 *    keyed by client address (`TRUST_PROXY`).
 * 3. `GET`/`HEAD` for a file in `dist/client` is served statically, with
 *    precompressed siblings or the bounded runtime fallback
 *    (`./staticFiles.ts`).
 * 4. `GET`/`HEAD` for the FFmpeg worker URL is served from memory.
 * 5. Everything else goes to the Expo Server handler — SSR HTML, loaders,
 *    API routes, the 404 page — and its response is stream-compressed when
 *    worthwhile (`./compression.ts`).
 *
 * Every response then gets security headers and an `X-Request-ID`, `/api`
 * responses get the CORS policy, and one access-log line is written.
 */

import { randomUUID } from "node:crypto";

import { applyCorsHeaders, isCorsPath, preflightResponse } from "../api/shared/cors";
import defaultRateLimitRules from "../rateLimits.js";
import {
  compressResponse,
  createStaticCompressor,
  isCompressibleContentType,
  MIN_COMPRESSIBLE_BYTES,
  negotiateEncodings,
  type CompressResponseOptions,
  type StaticCompressorOptions,
} from "./compression";
import { appendVary, withMutableHeaders } from "./headers";
import {
  createApiRateLimiter,
  parseTrustProxy,
  resolveClientAddress,
  type RateLimitRules,
} from "./rateLimit";
import { createStaticFileServer, SHORT_CACHE_CONTROL } from "./staticFiles";

type Env = Record<string, string | undefined>;

/** What `Bun.serve` passes as the second `fetch` argument, reduced to what is used. */
export interface PeerInfo {
  requestIP(request: Request): { address: string } | null;
}

export type FetchHandler = (request: Request, server?: PeerInfo) => Promise<Response>;

/** The FFmpeg worker served same-origin (`server/ffmpegWorker.js`). */
export interface FfmpegWorkerRoute {
  url: string;
  contents: string;
}

export interface CreateHandlerOptions {
  /** The web export's static directory, `dist/client`. */
  clientDir: string;
  /** Expo Server's request handler for `dist/server` (`createRequestHandler` from `expo-server/adapter/bun`). */
  expoHandler: (request: Request) => Response | Promise<Response>;
  /** Defaults to `process.env`. Reads `ALLOWED_ORIGINS`, `TRUST_PROXY`, `NODE_ENV`. */
  env?: Env;
  ffmpegWorker?: FfmpegWorkerRoute | null;
  /** Defaults to `server/rateLimits.js`. */
  rateLimits?: RateLimitRules;
  /** Bounds for the static runtime-compression fallback. */
  staticCompression?: StaticCompressorOptions;
  /** Options for streamed compression of Expo handler responses. */
  responseCompression?: CompressResponseOptions;
  /** Clock for the rate limiters. Defaults to `Date.now`. */
  now?: () => number;
  /** Access-log sink, one line per request. Defaults to `console.log`; `null` disables it. */
  log?: ((line: string) => void) | null;
  /** Error and warning sink. Defaults to `console.error`. */
  logError?: (message: string, error?: unknown) => void;
  /** Defaults to `crypto.randomUUID`. */
  requestId?: () => string;
}

const LOADER_PREFIX = "/_expo/loaders/";

/**
 * `/_expo/loaders/<route>.web` → `/_expo/loaders/<route>`, so a platform-
 * suffixed loader request resolves to the route's loader.
 */
function loaderNormalizedRequest(request: Request, url: URL): Request {
  if ((request.method !== "GET" && request.method !== "HEAD") || !url.pathname.startsWith(LOADER_PREFIX)) {
    return request;
  }

  const normalizedPathname = url.pathname.replace(/\.(web|native)$/, "");
  if (normalizedPathname === url.pathname) {
    return request;
  }

  const normalized = new URL(url);
  normalized.pathname = normalizedPathname;
  return new Request(normalized.toString(), {
    headers: request.headers,
    method: request.method,
  });
}

function applySecurityHeaders(headers: Headers, requestId: string, production: boolean): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Request-ID", requestId);

  if (production) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

export function createHandler(options: CreateHandlerOptions): FetchHandler {
  const env = options.env ?? process.env;
  const production = env.NODE_ENV === "production";
  const now = options.now ?? Date.now;
  const log = options.log === undefined ? (line: string) => console.log(line) : options.log;
  const logError = options.logError ?? ((message: string, error?: unknown) => {
    if (error === undefined) console.error(message);
    else console.error(message, error);
  });
  const nextRequestId = options.requestId ?? randomUUID;

  let trustedHops = parseTrustProxy(env.TRUST_PROXY);
  if (trustedHops === null) {
    logError(
      `Ignoring TRUST_PROXY=${JSON.stringify(env.TRUST_PROXY)}: expected a hop count, "true", or "false". ` +
        "Rate limits key on the direct peer address.",
    );
    trustedHops = 0;
  }

  const rateLimiter = createApiRateLimiter(
    options.rateLimits ?? (defaultRateLimitRules as RateLimitRules),
    { now },
  );
  const compressor = createStaticCompressor(options.staticCompression);
  const staticFiles = createStaticFileServer({ clientDir: options.clientDir, compressor });
  const ffmpegWorker = options.ffmpegWorker ?? null;
  const ffmpegWorkerBytes = ffmpegWorker ? new TextEncoder().encode(ffmpegWorker.contents) : null;
  const ffmpegWorkerLoadedAt = new Date().toUTCString();

  async function serveFfmpegWorker(request: Request): Promise<Response> {
    const bytes = ffmpegWorkerBytes!;
    const contentType = "application/javascript; charset=utf-8";
    const headers = new Headers({
      // The worker URL carries no content hash, so it must not be immutable.
      "Cache-Control": SHORT_CACHE_CONTROL,
      "Content-Type": contentType,
      "Last-Modified": ffmpegWorkerLoadedAt,
    });
    const isHead = request.method === "HEAD";

    if (isCompressibleContentType(contentType) && bytes.byteLength >= MIN_COMPRESSIBLE_BYTES) {
      appendVary(headers, "Accept-Encoding");
      const [encoding] = negotiateEncodings(request.headers.get("Accept-Encoding"));
      if (encoding) {
        const encoded = await compressor.compress(
          `ffmpeg-worker:${bytes.byteLength}`,
          bytes.byteLength,
          encoding,
          async () => bytes,
        );
        if (encoded) {
          headers.set("Content-Encoding", encoding);
          headers.set("Content-Length", String(encoded.byteLength));
          return new Response(isHead ? null : encoded, { headers });
        }
      }
    }

    headers.set("Content-Length", String(bytes.byteLength));
    return new Response(isHead ? null : bytes, { headers });
  }

  async function route(request: Request, url: URL, clientAddress: string): Promise<Response> {
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return isCorsPath(pathname) ? preflightResponse(request, env) : new Response(null, { status: 204 });
    }

    const limited = rateLimiter.check(pathname, clientAddress);
    if (limited) {
      return limited;
    }

    const isRead = request.method === "GET" || request.method === "HEAD";
    if (isRead) {
      const staticResponse = await staticFiles.serve(request, pathname);
      if (staticResponse) {
        return staticResponse;
      }

      if (ffmpegWorker && pathname === ffmpegWorker.url) {
        return serveFfmpegWorker(request);
      }
    }

    const response = await options.expoHandler(loaderNormalizedRequest(request, url));
    return compressResponse(request, response, options.responseCompression);
  }

  return async function handle(request, server) {
    const requestId = nextRequestId();
    const startedAt = performance.now();
    const url = new URL(request.url);
    const clientAddress = resolveClientAddress(
      request,
      server?.requestIP(request)?.address,
      trustedHops,
    );

    let response: Response;
    try {
      response = await route(request, url, clientAddress);
    } catch (error) {
      logError("Bun server request failed:", error);
      response = new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    response = withMutableHeaders(response);
    applySecurityHeaders(response.headers, requestId, production);
    if (isCorsPath(url.pathname)) {
      applyCorsHeaders(request, response.headers, env);
    }

    if (log) {
      const size = response.headers.get("Content-Length") || "-";
      log(
        `${clientAddress} - - [${new Date().toISOString()}] ` +
          `"${request.method} ${url.pathname}${url.search} HTTP/1.1" ${response.status} ${size} - ` +
          `${(performance.now() - startedAt).toFixed(3)} ms`,
      );
    }
    return response;
  };
}
