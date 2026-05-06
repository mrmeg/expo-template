import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { createRequestHandler } from "expo-server/adapter/bun";

type StaticEncoding = "br" | "gzip";

type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type FfmpegWorkerAsset = {
  absolutePath: string;
  contents: string;
} | null;

type BunServer = {
  requestIP(request: Request): { address: string } | null;
};

type BunStaticFile = Blob & {
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

declare const Bun: {
  file(filePath: string): BunStaticFile;
  serve(options: {
    port: number;
    fetch(request: Request, server: BunServer): Response | Promise<Response>;
  }): unknown;
};

const require = createRequire(import.meta.url);

const {
  GENERAL_LIMIT,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
} = require("./server/rateLimits.js") as {
  GENERAL_LIMIT: RateLimitConfig;
  MEDIA_SIGNER_LIMIT: RateLimitConfig;
  MEDIA_SIGNER_LIMIT_PATHS: string[];
  STRICT_LIMIT: RateLimitConfig;
  STRICT_LIMIT_PATHS: string[];
};

const { FFMPEG_WORKER_URL, loadFfmpegWorker } = require("./server/ffmpegWorker.js") as {
  FFMPEG_WORKER_URL: string;
  loadFfmpegWorker: (baseDir: string) => FfmpegWorkerAsset;
};

const CLIENT_BUILD_DIR = path.join(process.cwd(), "dist/client");
const SERVER_BUILD_DIR = path.join(process.cwd(), "dist/server");
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8081", "http://localhost:3000"];
const TEXT_STATIC_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".txt",
  ".xml",
]);

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

const compressedStaticCache = new Map<string, ArrayBuffer>();
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const expoRequestHandler = createRequestHandler({ build: SERVER_BUILD_DIR });
const ffmpegWorkerAsset = loadFfmpegWorker(process.cwd());

function allowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }

  const existing = current.split(",").map((entry) => entry.trim().toLowerCase());
  if (!existing.includes(value.toLowerCase())) {
    headers.set("Vary", `${current}, ${value}`);
  }
}

function applyCorsHeaders(request: Request, headers: Headers): void {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return;
  }

  appendVary(headers, "Origin");
  if (!allowedOrigins().includes(origin)) {
    return;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
}

function preflightResponse(request: Request): Response {
  const headers = new Headers();
  applyCorsHeaders(request, headers);
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization",
  );
  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}

function applySecurityHeaders(headers: Headers, requestId: string): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Request-ID", requestId);

  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function routeMatches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function clientAddress(request: Request, server: BunServer): string {
  const requestIp = server.requestIP(request)?.address;
  if (requestIp) {
    return requestIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function checkRateLimit(
  bucketName: string,
  request: Request,
  server: BunServer,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const key = `${bucketName}:${clientAddress(request, server)}`;
  const current = rateLimitBuckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + config.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  return {
    limited: bucket.count > config.max,
    limit: config.max,
    remaining: Math.max(config.max - bucket.count, 0),
    resetAt: bucket.resetAt,
  };
}

function rateLimitResponse(result: RateLimitResult, message: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1)),
  });
  return new Response(JSON.stringify({ error: message }), { status: 429, headers });
}

function applyApiRateLimits(request: Request, server: BunServer, pathname: string): Response | null {
  if (!routeMatches(pathname, "/api")) {
    return null;
  }

  const generalResult = checkRateLimit("general", request, server, GENERAL_LIMIT);
  if (generalResult.limited) {
    return rateLimitResponse(generalResult, "Too many requests, please try again later");
  }

  if (MEDIA_SIGNER_LIMIT_PATHS.some((route) => routeMatches(pathname, route))) {
    const mediaResult = checkRateLimit("media-signer", request, server, MEDIA_SIGNER_LIMIT);
    if (mediaResult.limited) {
      return rateLimitResponse(mediaResult, "Too many upload requests, please try again later");
    }
  }

  if (STRICT_LIMIT_PATHS.some((route) => routeMatches(pathname, route))) {
    const strictResult = checkRateLimit("strict", request, server, STRICT_LIMIT);
    if (strictResult.limited) {
      return rateLimitResponse(strictResult, "Too many requests, please try again later");
    }
  }

  return null;
}

function preferredStaticEncoding(request: Request): StaticEncoding | null {
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  if (/\bbr\b/.test(acceptEncoding)) {
    return "br";
  }
  if (/\bgzip\b/.test(acceptEncoding)) {
    return "gzip";
  }
  return null;
}

function shouldCompressStatic(filePath: string, contentType: string, size: number): boolean {
  if (size < 1024) {
    return false;
  }

  return (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("javascript") ||
    contentType.includes("xml") ||
    contentType.includes("svg") ||
    filePath.endsWith(".map") ||
    TEXT_STATIC_EXTENSIONS.has(path.extname(filePath))
  );
}

async function compressedStaticBody(filePath: string, encoding: StaticEncoding): Promise<ArrayBuffer> {
  const cacheKey = `${encoding}:${filePath}`;
  const cached = compressedStaticCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const source = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  const compressed = encoding === "br" ? brotliCompressSync(source) : gzipSync(source);
  const body = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(body).set(compressed);
  compressedStaticCache.set(cacheKey, body);
  return body;
}

function contentTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || Bun.file(filePath).type || "application/octet-stream";
}

function immutableStaticPath(pathname: string): boolean {
  return pathname.startsWith("/_expo/static/") || pathname.startsWith("/assets/");
}

function cacheControlFor(pathname: string): string {
  if (immutableStaticPath(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600";
}

function safeStaticPath(relativePath: string): string | null {
  const resolved = path.resolve(CLIENT_BUILD_DIR, relativePath);
  if (resolved === CLIENT_BUILD_DIR || resolved.startsWith(`${CLIENT_BUILD_DIR}${path.sep}`)) {
    return resolved;
  }
  return null;
}

function staticPathCandidates(pathname: string): string[] | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) {
    return null;
  }

  const normalized = path.posix.normalize(`/${decoded}`);
  const relative = normalized.replace(/^\/+/, "");
  const candidates = new Set<string>();

  if (!relative || normalized.endsWith("/")) {
    candidates.add(path.posix.join(relative, "index.html"));
  } else {
    candidates.add(relative);
    if (!path.posix.extname(relative)) {
      candidates.add(`${relative}.html`);
    }
  }

  return Array.from(candidates)
    .map((candidate) => safeStaticPath(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));
}

async function serveStaticFile(request: Request, pathname: string): Promise<Response | null> {
  const candidates = staticPathCandidates(pathname);
  if (!candidates) {
    return new Response("Bad Request", { status: 400 });
  }

  for (const filePath of candidates) {
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      continue;
    }

    const contentType = contentTypeFor(filePath);
    const headers = new Headers({
      "Cache-Control": cacheControlFor(pathname),
      "Content-Type": contentType,
      "Last-Modified": fileStat.mtime.toUTCString(),
    });

    const encoding = preferredStaticEncoding(request);
    if (encoding && shouldCompressStatic(filePath, contentType, fileStat.size)) {
      const body = await compressedStaticBody(filePath, encoding);
      headers.set("Content-Encoding", encoding);
      headers.set("Content-Length", String(body.byteLength));
      appendVary(headers, "Accept-Encoding");
      return new Response(request.method === "HEAD" ? null : body, { headers });
    }

    headers.set("Content-Length", String(fileStat.size));
    if (shouldCompressStatic(filePath, contentType, fileStat.size)) {
      appendVary(headers, "Accept-Encoding");
    }
    return new Response(request.method === "HEAD" ? null : Bun.file(filePath), { headers });
  }

  return null;
}

async function serveFfmpegWorker(request: Request, pathname: string): Promise<Response | null> {
  if (pathname !== FFMPEG_WORKER_URL || !ffmpegWorkerAsset) {
    return null;
  }

  const contentType = "application/javascript; charset=utf-8";
  const sourceSize = Buffer.byteLength(ffmpegWorkerAsset.contents);
  const headers = new Headers({
    "Cache-Control": cacheControlFor(pathname),
    "Content-Type": contentType,
    "Last-Modified": new Date().toUTCString(),
  });

  const encoding = preferredStaticEncoding(request);
  if (encoding && shouldCompressStatic(ffmpegWorkerAsset.absolutePath, contentType, sourceSize)) {
    const body = await compressedStaticBody(ffmpegWorkerAsset.absolutePath, encoding);
    headers.set("Content-Encoding", encoding);
    headers.set("Content-Length", String(body.byteLength));
    appendVary(headers, "Accept-Encoding");
    return new Response(request.method === "HEAD" ? null : body, { headers });
  }

  headers.set("Content-Length", String(sourceSize));
  appendVary(headers, "Accept-Encoding");
  return new Response(request.method === "HEAD" ? null : ffmpegWorkerAsset.contents, { headers });
}

function loaderNormalizedRequest(request: Request): Request {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return request;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/_expo/loaders/")) {
    return request;
  }

  const normalizedPathname = url.pathname.replace(/\.(web|native)$/, "");
  if (normalizedPathname === url.pathname) {
    return request;
  }

  url.pathname = normalizedPathname;
  return new Request(url.toString(), {
    headers: request.headers,
    method: request.method,
  });
}

async function appResponse(request: Request, server: BunServer): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return preflightResponse(request);
  }

  const limited = applyApiRateLimits(request, server, url.pathname);
  if (limited) {
    return limited;
  }

  const staticResponse = await serveStaticFile(request, url.pathname);
  if (staticResponse) {
    return staticResponse;
  }

  const ffmpegResponse = await serveFfmpegWorker(request, url.pathname);
  if (ffmpegResponse) {
    return ffmpegResponse;
  }

  return expoRequestHandler(loaderNormalizedRequest(request));
}

function logRequest(request: Request, response: Response, elapsedMs: number, server: BunServer): void {
  const url = new URL(request.url);
  const size = response.headers.get("Content-Length") || "-";
  console.log(
    `${clientAddress(request, server)} - - [${new Date().toISOString()}] ` +
      `"${request.method} ${url.pathname}${url.search} HTTP/1.1" ${response.status} ${size} - ${elapsedMs.toFixed(3)} ms`,
  );
}

async function fetch(request: Request, server: BunServer): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = performance.now();
  let response: Response;

  try {
    response = await appResponse(request, server);
  } catch (error) {
    console.error("Bun server request failed:", error);
    response = new Response("Internal Server Error", { status: 500 });
  }

  applySecurityHeaders(response.headers, requestId);
  applyCorsHeaders(request, response.headers);
  logRequest(request, response, performance.now() - startedAt, server);
  return response;
}

const port = Number(process.env.PORT || 3000);

Bun.serve({
  port,
  fetch,
});

console.log(`Bun server listening on port ${port}`);
