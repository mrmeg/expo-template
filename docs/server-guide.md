# Expo Server Guide

This guide is the LLM-facing reference for replicating this template's server
stack — server-rendered web output, API routes, request middleware, and data
loaders — in another Expo Router project. Data loaders and middleware are Expo
Router alpha features behind `unstable_` flags (the demos call this surface
"Server Alpha"); expect their APIs to move between SDK versions, and check the
pinned Expo version in `package.json` before copying patterns.

## Source Map

| Concern | Source |
|---------|--------|
| Server output and router flags | `app.config.ts` |
| Production server, default (Bun) | `server.bun.ts` |
| Production server, fallback (Express) | `server/index.ts` |
| Rate-limit buckets | `server/rateLimits.js` |
| Request middleware | `app/+middleware.ts` |
| Data loaders (demo feature) | `client/features/server-alpha/loaders.ts` |
| Loader-backed routes | `app/(main)/(demos)/server-alpha.tsx`, `app/(main)/(demos)/server-alpha/[example].tsx` |
| Loader-consuming screens | `client/features/server-alpha/ServerAlphaDemoScreen.tsx`, `ServerAlphaExampleScreen.tsx` |
| API routes | `app/api/**/+api.ts` |
| Shared API helpers (CORS, errors, auth) | `server/api/shared/` |
| SSR first-render constraints | `docs/ssr-hydration.md` |

The Server Alpha demo at route `/server-alpha` walks four live patterns:
`loader-overview` (loaders hydrate SSR pages), `dynamic-loader` (route params
flow into typed loaders), `api-route` (handlers own parsing and mutations),
and `middleware` (request-scoped headers without business logic).

## Enable Server Output

In `app.config.ts`, set the web output mode and the Expo Router plugin flags:

```ts
web: { bundler: "metro", output: "server" },
experiments: { typedRoutes: true },
plugins: [
  [
    "expo-router",
    {
      origin: "",
      unstable_useServerRendering: true,
      unstable_useServerMiddleware: true,
      unstable_useServerDataLoaders: true,
      // Keep development web routes eager for HMR; async in production.
      asyncRoutes: { web: "production" },
    },
  ],
],
```

- `output: "server"` makes `expo export -p web` emit `dist/client` (static
  assets) plus `dist/server` (request handler, routes, loaders).
- `unstable_useServerRendering` enables SSR for web routes.
- `unstable_useServerMiddleware` enables `app/+middleware.ts`.
- `unstable_useServerDataLoaders` enables route `loader` exports and
  `useLoaderData`.

## Serve The Build

Development: `bun run web` (Expo dev server runs SSR, loaders, middleware, and
API routes in place).

Production: `bun run build` exports `dist/`, then either entry serves it:

- `bun run start` — `server.bun.ts`, the default. Wraps
  `createRequestHandler({ build: "dist/server" })` from
  `expo-server/adapter/bun`.
- `bun run start:express` — `server/index.ts`, Node fallback. Same behavior
  via `expo-server/adapter/express` and `express-rate-limit`, `cors`,
  `compression`, `morgan`.

Both entries own concerns that Expo's request handler does not:

- CORS origin allowlist from the `ALLOWED_ORIGINS` env var (comma-separated;
  localhost defaults otherwise), echoing only allowlisted origins and managing
  `Vary: Origin`.
- Per-IP rate-limit buckets defined in `server/rateLimits.js`: general
  (500/15 min), media signing (60/min), strict (10/min).
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Request-ID`, and HSTS in
  production.
- Static caching and compression: 1-year cache for `/_expo/static/` and
  `/assets/`, brotli/gzip for text-like bodies over 1KB (Bun entry caches
  compressed bodies in memory).
- Loader path normalization: strips `.web`/`.native` suffixes from
  `/_expo/loaders/*` requests so platform-specific loader files resolve.

## API Routes

Route files live at `app/api/**/<name>+api.ts` and export HTTP-method
handlers. Keep them thin — parsing, validation, and domain logic live in
`server/` modules. The canonical shape (from `app/api/template/status+api.ts`):

```ts
import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateServerStatus } from "@/server/api/template/status";

export function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

export function GET(request: Request) {
  return Response.json(getTemplateServerStatus(request), {
    headers: { "Cache-Control": "no-store", ...getCorsHeaders(request) },
  });
}
```

Shared helpers under `server/api/shared/`:

| Helper | Purpose |
|--------|---------|
| `cors.ts` | `getCorsHeaders(request)`, `getPreflightHeaders(request)`, production error redaction |
| `errors.ts` | `jsonErrorResponse`, `unauthorizedResponse`, `forbiddenResponse`, `badRequestResponse` — typed `{ code, message }` bodies with CORS applied |
| `auth.ts` | `requireAuthenticatedUser(request)` returns `{ ok: true, user } \| { ok: false, response }`; fails closed with 401 when no verifier is bootstrapped |
| `authBootstrap.ts`, `cognitoTokenVerifier.ts` | Register a process-wide token verifier at startup; tests reset with `setTokenVerifier(null)` |

Optional features must fail closed: missing env returns a typed disabled
response (for example the media routes' `503 media-disabled`), never a crash.

## Data Loaders

Loaders give web routes server-fetched, SSR-hydrated data. The pattern has
three parts.

Define loaders in a feature folder, typed with `LoaderFunction<T>`, returning
JSON-serializable data. Dynamically import server modules inside the loader
body so server-only code stays out of the client bundle
(`client/features/server-alpha/loaders.ts`):

```ts
import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";

export const serverAlphaLoader: LoaderFunction<TemplateServerCatalog> = async (request) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls do not have an active
    // Expo Server request scope.
  }
  const { getTemplateServerCatalog } = await import("@/server/api/template/examples");
  return getTemplateServerCatalog(request);
};
```

Dynamic-route loaders receive params as the second argument:

```ts
export const serverAlphaExampleLoader: LoaderFunction<ExampleLoaderData> = async (
  request,
  params,
) => {
  // params.example is string | string[] | undefined for app/.../[example].tsx
};
```

Re-export from the route file under the name `loader`, next to the screen
(`app/(main)/(demos)/server-alpha.tsx`):

```ts
export { serverAlphaLoader as loader } from "@/client/features/server-alpha/loaders";
export { default } from "@/client/features/server-alpha/ServerAlphaDemoScreen";
```

Consume in the screen with `useLoaderData`, typed by the loader itself:

```ts
import { useLoaderData } from "expo-router";

const catalog = useLoaderData<typeof serverAlphaLoader>();
```

Loader rules:

- Loaders are read-only. Mutations belong in API route handlers.
- Wrap `setResponseHeaders` in try/catch; static export and unit tests run
  loaders without an active request scope.
- Pair each loader with an API route exposing the same data so the client can
  refetch after hydration (`serverAlphaLoader` pairs with
  `app/api/template/examples+api.ts`).
- Return only JSON-serializable values; loader output crosses the
  server/client boundary.

## Request Middleware

`app/+middleware.ts` runs on matched server requests. Declare an explicit
matcher and keep middleware to request-scoped headers and observability —
auth decisions and mutations belong in route handlers:

```ts
import { setResponseHeaders } from "expo-server";
import type { MiddlewareSettings } from "expo-server";
import type { MiddlewareFunction } from "expo-router/server";

export const unstable_settings: MiddlewareSettings = {
  matcher: {
    patterns: ["/api", "/api/[...path]", "/server-alpha", "/server-alpha/[example]"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },
};

const middleware: MiddlewareFunction = (request) => {
  setResponseHeaders((headers) => {
    headers.set("X-Expo-Router-Middleware", "1");
    // The repo version also appends Origin to Vary for CORS-cache safety.
  });
};

export default middleware;
```

Note the matcher lists both the public path (`/server-alpha`) and the grouped
route path (`/(main)/(demos)/server-alpha`) in the repo file — match the route
shapes your app actually serves.

## SSR Constraints

Server-rendered web means the first client render must match server HTML.
Before touching root startup, theme startup, fonts, i18n, viewport logic, or
`app/+html.tsx`, read `docs/ssr-hydration.md` and verify with real server
HTML, not only tests.

## Replication Checklist

Use this order when adding the server stack to another Expo Router project:

1. Set `web.output: "server"` and the three `unstable_` router flags in app
   config; confirm the Expo SDK version supports them.
2. Add a server entry (`server.bun.ts` or `server/index.ts` equivalent) that
   wraps the `expo-server` adapter and owns CORS, rate limits, security
   headers, and static caching.
3. Create `server/api/shared/` with the CORS, error, and auth helpers; keep
   route files thin handler exports.
4. Add API routes under `app/api/**/+api.ts` with `OPTIONS` preflight and
   CORS headers on every response.
5. Add `app/+middleware.ts` with an explicit matcher, limited to headers and
   observability.
6. Add loaders per feature folder, re-export as `loader` from route files,
   consume with `useLoaderData<typeof loaderFn>()`, and pair each with an API
   route for client refetch.
7. Verify SSR hydration per `docs/ssr-hydration.md`.

## Validation

```bash
bun run typecheck
bun run lint
bun run test:ci
bun run build
bun run start   # then curl a loader-backed route and inspect server HTML
```

For loader and API behavior, test the underlying server modules directly
(see `app/api/template/__tests__/` and `server/api/shared/__tests__/`) and
verify loader-backed pages render expected data in real server output.
