/**
 * The CORS policy — the one implementation behind every CORS header this
 * app sends. API routes spread `getCorsHeaders` / `getPreflightHeaders` into
 * their responses, `app/+middleware.ts` applies `applyCorsHeaders` to every
 * matched `/api` response, and the Bun server (`server/http/createHandler.ts`)
 * answers preflights with `preflightResponse` and applies `applyCorsHeaders`
 * to the `/api` responses it produces itself (rate limits, errors).
 *
 * The policy is what the routes under `app/api/` need, and no more:
 *
 * - Scope: `/api` and everything below it. Pages, loaders, and static assets
 *   are fetched from the page's own origin and carry no CORS headers.
 * - Origins: exact matches from `ALLOWED_ORIGINS` (comma-separated), or the
 *   local dev origins when it is unset or blank. An allowed origin is echoed
 *   back in `Access-Control-Allow-Origin`; any other origin gets no grant.
 *   There is no wildcard.
 * - No credentials: routes authenticate with an `Authorization: Bearer`
 *   token, never cookies, so `Access-Control-Allow-Credentials` is never sent.
 * - Methods: GET, POST, DELETE (plus OPTIONS) — every method an `app/api`
 *   route exports. Add a method here when a route starts exporting it
 *   (`server/api/shared/__tests__/cors.test.ts` fails until you do).
 * - Request headers: `Content-Type` and `Authorization`, which
 *   `client/lib/api/authenticatedFetch.ts` sends, plus `sentry-trace` and
 *   `baggage`, which Sentry's browser tracing attaches to localhost requests.
 * - Preflight cache: 24 hours (browsers cap it lower).
 * - `Vary: Origin` on every API response, with or without an `Origin`
 *   header, because the grant depends on it.
 */

// Relative, not `@/`: the Bun entry loads this file directly as well as
// through Metro's route and middleware bundles.
import { appendVary } from "../../http/headers";

type Env = Record<string, string | undefined>;

/** A `Request`, or the read-only `ImmutableRequest` middleware receives. */
type RequestLike = { headers: { get(name: string): string | null } };

const DEFAULT_ORIGINS = ["http://localhost:8081", "http://localhost:3000"];

export const CORS_ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"] as const;
export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "sentry-trace",
  "baggage",
] as const;
export const CORS_MAX_AGE_SECONDS = 86400;

let parsedOrigins: { raw: string | undefined; origins: string[] } | null = null;

/** `https://App.example.com/` → `https://app.example.com`; unparseable entries stay as typed. */
function normalizeOrigin(entry: string): string {
  try {
    const { origin } = new URL(entry);
    return origin === "null" ? entry : origin;
  } catch {
    return entry;
  }
}

export function getAllowedOrigins(env: Env = process.env): string[] {
  const raw = env.ALLOWED_ORIGINS;
  if (parsedOrigins && parsedOrigins.raw === raw) {
    return parsedOrigins.origins;
  }

  const configured = raw?.trim()
    ? raw.split(",").flatMap((entry) => {
      const trimmed = entry.trim();
      return trimmed ? [normalizeOrigin(trimmed)] : [];
    })
    : DEFAULT_ORIGINS;
  parsedOrigins = { raw, origins: configured };
  return configured;
}

export function isAllowedOrigin(origin: string, env?: Env): boolean {
  return getAllowedOrigins(env).includes(origin);
}

/** True for the paths the CORS policy covers: `/api` and everything below it. */
export function isCorsPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * CORS headers for an API response. An allowed `Origin` is echoed back; a
 * missing or disallowed one gets `Vary: Origin` alone.
 */
export function getCorsHeaders(request: RequestLike, env?: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !isAllowedOrigin(origin, env)) {
    return { Vary: "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

/**
 * Headers for a preflight (OPTIONS) response. The allowed methods and
 * headers are only advertised to an allowed origin.
 */
export function getPreflightHeaders(request: RequestLike, env?: Env): Record<string, string> {
  const headers = getCorsHeaders(request, env);
  if (!headers["Access-Control-Allow-Origin"]) {
    return { ...headers, "Access-Control-Max-Age": String(CORS_MAX_AGE_SECONDS) };
  }

  return {
    ...headers,
    "Access-Control-Allow-Methods": CORS_ALLOWED_METHODS.join(", "),
    "Access-Control-Allow-Headers": CORS_ALLOWED_HEADERS.join(", "),
    "Access-Control-Max-Age": String(CORS_MAX_AGE_SECONDS),
  };
}

/**
 * Apply the policy to an existing response's headers in place. `Vary` is
 * merged rather than replaced, so a route's own `Vary` entries survive.
 */
export function applyCorsHeaders(request: RequestLike, headers: Headers, env?: Env): void {
  for (const [name, value] of Object.entries(getCorsHeaders(request, env))) {
    if (name === "Vary") {
      appendVary(headers, value);
    } else {
      headers.set(name, value);
    }
  }
}

/** A complete answer to a preflight request. */
export function preflightResponse(request: RequestLike, env?: Env): Response {
  return new Response(null, { status: 204, headers: getPreflightHeaders(request, env) });
}

/**
 * Sanitize error details for API responses.
 * In development, returns the full error message. In production, returns nothing.
 */
export function sanitizeErrorDetails(error: unknown): Record<string, string> {
  if (process.env.NODE_ENV !== "production") {
    return { details: error instanceof Error ? error.message : String(error) };
  }
  return {};
}
