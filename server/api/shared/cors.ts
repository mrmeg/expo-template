/**
 * Shared CORS utility for Expo Router API routes.
 *
 * Replaces per-file `Access-Control-Allow-Origin: *` with origin validation
 * against the ALLOWED_ORIGINS env var.
 */

const DEFAULT_ORIGINS = ["http://localhost:8081", "http://localhost:3000"];

function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : DEFAULT_ORIGINS;
}

/**
 * Build CORS headers for a given request.
 *
 * - If the request Origin matches an allowed origin, echoes it back.
 * - If no Origin header (native app, same-origin), omits CORS headers.
 * - Always includes Vary: Origin to prevent cache poisoning.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");

  if (!origin) {
    // No Origin header — same-origin or native app. No CORS headers needed.
    return {};
  }

  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    // Origin not in allowlist — return Vary but no Access-Control-Allow-Origin
    return { "Vary": "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

/**
 * Build preflight (OPTIONS) response headers.
 */
export function getPreflightHeaders(request: Request): Record<string, string> {
  return {
    ...getCorsHeaders(request),
    "Access-Control-Max-Age": "86400",
  };
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
