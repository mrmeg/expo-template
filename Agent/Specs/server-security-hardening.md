# Spec: Server Security Hardening

**Status:** Ready
**Priority:** High
**Scope:** Server

## What

Add security headers to the Express server and replace wildcard CORS in API routes with configurable allowed origins. Sanitize error responses to prevent stack trace leakage.

## Why

The Express server lacks standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy). All four API routes use `Access-Control-Allow-Origin: *`, allowing any domain to call upload, delete, and list endpoints. Error responses in API routes include `error.message` in the `details` field, which can leak internal paths, SDK versions, and stack information to callers.

## Current State

### Express server (`server/index.ts`)

- Disables `x-powered-by` header (good).
- Uses the `cors` middleware with configurable `ALLOWED_ORIGINS` env var, defaulting to `["http://localhost:8081", "http://localhost:3000"]`. This is properly restrictive.
- Uses `compression` middleware.
- Uses `morgan("tiny")` for request logging.
- Has rate limiting: general (500 req/15min) on `/api` and strict (10 req/min) on sensitive endpoints.
- **Missing:** No `helmet` or manual security headers. No HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Content-Security-Policy, or Permissions-Policy headers.
- Static files served with `maxAge: "1h"` but no `immutable` flag or cache-busting strategy.

### API routes (`app/api/media/`)

All four files (`getUploadUrl+api.ts`, `delete+api.ts`, `list+api.ts`, `getSignedUrls+api.ts`) share the same pattern:

- Each defines its own `CORS_HEADERS` constant with `"Access-Control-Allow-Origin": "*"`.
- Each has an `OPTIONS` handler returning these wildcard CORS headers.
- Each attaches CORS headers to every response (success and error).
- `getSignedUrls+api.ts` inlines the CORS headers instead of using a shared constant, duplicating the values across multiple response blocks.

This means even though the Express server restricts CORS for its own routes, the Expo Router API routes bypass that entirely with `*`.

### Error response leakage

All four API routes include error details in 500 responses:

```ts
JSON.stringify({
  message: "Internal server error",
  details: error instanceof Error ? error.message : String(error),
})
```

The `error.message` from AWS SDK errors can contain bucket names, endpoint URLs, credential hints, and internal paths.

## Changes

### 1. Add security headers to Express server

Add a middleware function in `server/index.ts` that sets standard security headers on every response:

```ts
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
```

Place this after `app.disable("x-powered-by")` and before the CORS middleware. Do not add `helmet` as a dependency -- use manual headers to keep the server lightweight.

### 2. Replace wildcard CORS in API routes

Create a shared CORS utility at `app/api/_shared/cors.ts`:

```ts
export function getCorsHeaders(): Record<string, string> {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:8081", "http://localhost:3000"];
  // For API routes, return configured origins or fallback
  // Note: Expo API routes don't have access to the request origin in the same way,
  // so we use the first allowed origin or a restrictive default
}
```

Update each API route to:
- Import CORS headers from the shared utility instead of defining `*` inline.
- Accept an `origin` parameter from the request headers and validate it against the allowed list.
- Return the matched origin (not `*`) in `Access-Control-Allow-Origin`, or omit the header if the origin is not allowed.

### 3. Sanitize error responses

Replace the `details` field in all API route error responses:

**Before:**
```ts
details: error instanceof Error ? error.message : String(error),
```

**After:**
In development, keep the details for debugging. In production, return a generic message:

```ts
...(process.env.NODE_ENV !== "production" && {
  details: error instanceof Error ? error.message : String(error),
})
```

This ensures 500 responses in production contain only `{ "message": "Internal server error" }` without leaking SDK internals.

### 4. Add `X-Request-ID` header support

Add a simple request ID middleware to `server/index.ts` that generates a unique ID per request (using `crypto.randomUUID()`) and sets it as both a response header and a property on the request object. This aids debugging and log correlation without adding dependencies.

## Acceptance Criteria

- [ ] Express server responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` headers.
- [ ] HSTS header is present only when `NODE_ENV=production`.
- [ ] API routes no longer return `Access-Control-Allow-Origin: *`. They return the requesting origin only if it matches the allowed list.
- [ ] API routes share a single CORS utility instead of duplicating headers in four files.
- [ ] Error responses in production do not include `details` field with error messages.
- [ ] Error responses in development still include `details` for debugging.
- [ ] `X-Request-ID` header is present on all Express server responses.
- [ ] Rate limiting still works as before (no regressions).
- [ ] The `OPTIONS` preflight handlers in all API routes return correct CORS headers for allowed origins.

## Constraints

- No new npm dependencies. Use built-in Node.js APIs (`crypto.randomUUID()`).
- Do not change the rate limiting configuration.
- Do not change the static file serving configuration.
- Keep the `ALLOWED_ORIGINS` env var as the source of truth for both Express CORS and API route CORS.
- API routes are Expo Router API routes (file-based, `+api.ts` convention), not Express middleware. They cannot use `app.use()` -- each route must import the shared utility.

## Out of Scope

- Content-Security-Policy (CSP) -- requires analysis of all inline scripts, styles, and third-party resources. Deserves its own spec.
- Authentication/authorization on API routes (currently unauthenticated; a separate concern).
- HTTPS setup or TLS configuration (infrastructure concern).
- `helmet` package integration (keeping server dependency-light).
- Rate limiting changes.
- Request body size limits.

## Files Likely Affected

- `server/index.ts`
- `app/api/_shared/cors.ts` (new)
- `app/api/media/getUploadUrl+api.ts`
- `app/api/media/delete+api.ts`
- `app/api/media/list+api.ts`
- `app/api/media/getSignedUrls+api.ts`

## Edge Cases

- **Expo Router API routes and request origin:** Expo Router API routes receive a standard `Request` object. The `Origin` header may be absent for same-origin requests or non-browser clients (e.g., mobile apps calling the API directly). When `Origin` is absent, the CORS headers should be omitted entirely (browsers won't enforce CORS for same-origin, and non-browser clients ignore CORS).
- **Multiple allowed origins:** The `Access-Control-Allow-Origin` header only accepts a single origin value (not a comma-separated list). The utility must check the incoming `Origin` against the allowed list and echo back the matching one, or omit the header.
- **Vary header:** When dynamically selecting the `Access-Control-Allow-Origin` value based on the request origin, the response must include `Vary: Origin` to prevent CDN/proxy cache poisoning.
- **Preflight caching:** The `Access-Control-Max-Age: 86400` in OPTIONS responses caches preflight results for 24 hours. If allowed origins change, cached preflights will use stale CORS headers until they expire.
- **Native app requests:** React Native `fetch` on iOS/Android does not send an `Origin` header. The CORS utility must handle this gracefully -- either by allowing requests without an `Origin` header (since CORS is a browser-only mechanism) or by checking for an auth token instead.
- **Development CORS:** Expo dev server runs on port 8081 by default. The default allowed origins already include this, but developers using custom ports need to set `ALLOWED_ORIGINS`.
