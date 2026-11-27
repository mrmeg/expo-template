/**
 * HTTP plumbing for `createAnalyticsServer`: the route and context types,
 * dispatch, CORS, size-capped body reading, request facts, and the Node
 * (Express/Connect) adapter. Fetch `Request`/`Response` throughout, so the
 * same handler runs in Expo Router API routes, Bun and Node (anything with
 * `Buffer` and `node:crypto`).
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { LIMITS } from "../shared/wire";
import type { AnalyticsServerConfig, StoreContext } from "./config";
import { hostOf } from "./util";

/** What every route handler receives. */
export interface AnalyticsContext extends StoreContext {
  config: AnalyticsServerConfig;
  /** Logs through `config.onError`; never throws. */
  reportError(error: unknown, where: string): void;
}

export interface RouteRequest {
  request: Request;
  url: URL;
  /** `:name` segments of the matched pattern, decoded. */
  params: Record<string, string>;
}

export interface Route {
  method: string;
  /** Relative to `basePath`, e.g. `/e` or `/go/:channel`. */
  pattern: string;
  /** `admin` routes answer 404 unless `config.isAdmin` says yes, so their existence is not disclosed. */
  access: "public" | "admin";
  /** Mounted only when this returns true; lets optional features stay unreachable when unconfigured. */
  enabled?: (config: AnalyticsServerConfig) => boolean;
  handler(ctx: AnalyticsContext, input: RouteRequest): Promise<Response>;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

export function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}

/** `/analytics/` and `analytics` both mean `/analytics`; `/` means the root. */
export function normalizeBasePath(basePath: string | undefined): string {
  const trimmed = (basePath ?? "/analytics").trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** The part of `pathname` under `base`, or null when it is outside. */
export function subpath(pathname: string, base: string): string | null {
  if (base === "") return pathname;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null;
}

export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split("/").filter(Boolean);
  const got = path.split("/").filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) {
      try {
        params[want[i].slice(1)] = decodeURIComponent(got[i]);
      } catch {
        return null;
      }
    } else if (want[i] !== got[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Finds and runs the route for `request`. Null when the path is outside
 * `base`. The route table is a parameter so later features (and tests) can
 * pass their own list.
 */
export async function dispatch(
  ctx: AnalyticsContext,
  routes: readonly Route[],
  base: string,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = subpath(url.pathname, base);
  if (path === null) return null;
  for (const route of routes) {
    if (route.method !== request.method) continue;
    if (route.enabled && !route.enabled(ctx.config)) continue;
    const params = matchPattern(route.pattern, path);
    if (!params) continue;
    if (route.access === "admin") {
      // A throwing admin check stays closed and looks like any other miss.
      let admin = false;
      try {
        admin = (await ctx.config.isAdmin?.(request)) === true;
      } catch (error) {
        ctx.reportError(error, "isAdmin");
      }
      if (!admin) return notFound();
    }
    return route.handler(ctx, { request, url, params });
  }
  return notFound();
}

/** The host the client addressed: a proxy's `x-forwarded-host` first, then `Host`, then the URL. */
export function requestHost(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return hostOf(forwarded || request.headers.get("host") || new URL(request.url).host);
}

export function defaultClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get("x-real-ip")?.trim() || null;
}

/** ISO 3166 alpha-2 from `cf-ipcountry`; Cloudflare's `XX` (unknown) and `T1` (Tor) are not countries. */
export function defaultCountry(request: Request): string | null {
  const value = request.headers.get("cf-ipcountry")?.trim().toUpperCase();
  return value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1" ? value : null;
}

export type OriginCheck =
  | {
      allowed: true;
      headers: Record<string, string>;
      /** False when only `"*"` let the request in: its cookies must not identify anyone. */
      credentials: boolean;
    }
  | { allowed: false };

/**
 * Decides whether a POST may write events. No `Origin` (native apps, servers)
 * and same-origin requests are allowed; a cross-origin one only when listed.
 * This is enforced here rather than left to the browser because a
 * `sendBeacon` `text/plain` POST is a CORS simple request: no preflight runs,
 * so the browser would deliver it from any site.
 *
 * A listed origin gets credentials (so `resolveUserId` can read its cookie).
 * `"*"` never does, and withholding the CORS credentials header is not enough:
 * the browser still sends the victim's cookies on a simple request, so the
 * caller must also skip `resolveUserId` when `credentials` is false. Otherwise
 * any site could write events as a signed-in user.
 */
export function checkOrigin(request: Request, allowed: AnalyticsServerConfig["allowedOrigins"]): OriginCheck {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return origin ? { allowed: false } : { allowed: true, headers: {}, credentials: true };
  let originHost: string | null;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { allowed: false };
  }
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const ownHost = (forwarded || request.headers.get("host") || new URL(request.url).host).toLowerCase();
  if (originHost === ownHost) return { allowed: true, headers: {}, credentials: true };
  if (allowed === "*") return { allowed: true, headers: { "access-control-allow-origin": "*" }, credentials: false };
  if (allowed?.includes(origin)) {
    return {
      allowed: true,
      credentials: true,
      headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", vary: "Origin" },
    };
  }
  return { allowed: false };
}

/** `OPTIONS <base>/e`. A refused origin gets a bare 204, which the browser treats as a failed preflight. */
export function preflight(request: Request, allowed: AnalyticsServerConfig["allowedOrigins"]): Response {
  const check = checkOrigin(request, allowed);
  const headers: Record<string, string> = { "cache-control": "no-store", vary: "Origin" };
  if (check.allowed && request.headers.get("origin")) {
    Object.assign(headers, check.headers, {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    });
  }
  return new Response(null, { status: 204, headers });
}

/** True when `content-length` already says the body is over `max`; checked before reading anything. */
export function declaresTooLarge(request: Request, max = LIMITS.bodyMaxBytes): boolean {
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > max;
}

/**
 * Reads the body as UTF-8, stopping as soon as it passes `max` bytes, because
 * the declared length is optional (chunked uploads) and may lie. Null when too large.
 */
export async function readBodyText(request: Request, max = LIMITS.bodyMaxBytes): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** The parts of a Node or Express request the adapter reads. Express 4 and 5 requests both fit. */
export type NodeRequestLike = IncomingMessage & {
  /** Express sets this to the full path even when the middleware is mounted on a prefix. */
  originalUrl?: string;
  /** Whatever a body parser left, if one ran first. */
  body?: unknown;
};

export type NodeNext = (error?: unknown) => void;

/** What `toNodeHandler` needs from the server. */
export interface NodeHandlerTarget {
  basePath: string;
  handle(request: Request): Promise<Response | null>;
}

class BodyTooLarge extends Error {}

async function readNodeStream(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.byteLength;
    if (size > max) throw new BodyTooLarge();
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * The body for the Fetch request. A body parser that ran first has consumed
 * the stream (`readableEnded`), so its result is reused: an object is
 * re-serialized as JSON, a string or Buffer is used as is. Otherwise the stream
 * is read here, capped. `req.body` alone is not proof of parsing: Express 4's
 * parsers set `{}` on requests they skipped.
 */
async function nodeBody(req: NodeRequestLike): Promise<Buffer | null> {
  if (req.method === "GET" || req.method === "HEAD") return null;
  if (req.readableEnded) {
    const body = req.body;
    if (body === undefined || body === null) return null;
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (typeof body === "string") return Buffer.from(body, "utf8");
    return Buffer.from(JSON.stringify(body), "utf8");
  }
  return readNodeStream(req, LIMITS.bodyMaxBytes);
}

function nodeHeaders(req: IncomingMessage, rewritten: boolean): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    // Our buffer replaces the wire body, so its framing headers no longer apply.
    if (rewritten && (name === "content-length" || name === "transfer-encoding")) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }
  return headers;
}

async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie?.() ?? [];
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") res.setHeader(name, value);
  });
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  if (body && !res.hasHeader("content-length")) res.setHeader("content-length", body.byteLength);
  res.end(body ?? undefined);
}

/**
 * Express/Connect middleware: `app.use(toNodeHandler(server))`. Requests
 * outside `basePath` go straight to `next()` without their body being read, so
 * the host's other routes are unaffected. Imports no Express types; works on
 * Express 4 and 5 and on a bare `node:http` server (without `next`, an
 * unmatched request gets 404).
 */
export function toNodeHandler(server: NodeHandlerTarget) {
  return async function analyticsMiddleware(req: NodeRequestLike, res: ServerResponse, next?: NodeNext): Promise<void> {
    try {
      const rawUrl = req.originalUrl ?? req.url ?? "/";
      const encrypted = (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true;
      let url: URL;
      try {
        url = new URL(rawUrl, `${encrypted ? "https" : "http"}://${req.headers.host ?? "localhost"}`);
      } catch {
        // An unparseable Host header: route on the path alone so a request for
        // one of the host's own routes still reaches it.
        url = new URL(rawUrl, "http://localhost");
      }
      if (subpath(url.pathname, server.basePath) === null) {
        if (next) next();
        else await writeNodeResponse(res, notFound());
        return;
      }

      let body: Buffer | null;
      try {
        const declared = Number(req.headers["content-length"]);
        if (Number.isFinite(declared) && declared > LIMITS.bodyMaxBytes) throw new BodyTooLarge();
        body = await nodeBody(req);
      } catch (error) {
        if (!(error instanceof BodyTooLarge)) throw error;
        res.setHeader("connection", "close");
        await writeNodeResponse(res, json({ error: "payload too large" }, 413));
        return;
      }

      const request = new Request(url, {
        method: req.method ?? "GET",
        headers: nodeHeaders(req, body !== null),
        body: body && body.byteLength > 0 ? new Uint8Array(body) : undefined,
      });
      const response = await server.handle(request);
      if (response === null) {
        if (next) next();
        else await writeNodeResponse(res, notFound());
        return;
      }
      await writeNodeResponse(res, response);
    } catch (error) {
      if (next) {
        next(error);
      } else if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    }
  };
}
