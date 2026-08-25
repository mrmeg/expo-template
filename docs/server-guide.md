# Expo Server Guide

This guide is the LLM-facing reference for replicating this template's server
stack — server-hosted web output, API routes, request middleware, and data
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
| Loader-backed route | `app/(main)/(demos)/server-alpha/index.tsx` |
| Param'd route, API-fetched | `app/(main)/(demos)/server-alpha/[example].tsx` |
| Demo screens | `client/features/server-alpha/ServerAlphaDemoScreen.tsx`, `ServerAlphaExampleScreen.tsx` |
| API routes | `app/api/**/+api.ts` |
| Shared API helpers (CORS, errors, auth) | `server/api/shared/` |

The Server Alpha demo at route `/server-alpha` walks four live patterns:
`loader-overview` (a static route's loader supplies its page data),
`dynamic-loader` (a param'd route fetches the matching API route, because a
loader cannot answer a param'd request — see Data Loaders), `api-route`
(handlers own parsing and mutations), and `middleware` (request-scoped headers
without business logic).

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
      unstable_useServerMiddleware: true,
      unstable_useServerDataLoaders: true,
    },
  ],
],
```

- `output: "server"` makes `expo export -p web` emit `dist/client` (static
  assets) plus `dist/server` (request handler, routes, loaders).
- `unstable_useServerMiddleware` enables `app/+middleware.ts`.
- `unstable_useServerDataLoaders` enables route `loader` exports and
  `useLoaderData`.
- There is deliberately no `unstable_useServerRendering`. Web routes are
  client-rendered: each one gets an HTML shell written at export time and the
  app takes over after hydration. That keeps a single render path for native
  and web, at the cost of crawlers seeing only the shell (see
  `client/components/Seo.tsx`). Turning per-request rendering back on
  reintroduces a whole class of first-render/hydration constraints.

## Serve The Build

Development: `bun run web` (Expo dev server runs loaders, middleware, and API
routes in place).

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

### Route Consolidation (Bundle Size)

`expo export` emits every `+api.ts` file as its own **self-contained server
bundle** — sibling routes duplicate every shared dependency. Before
consolidation this repo shipped the S3 + auth stack four times (~808 KB × 4
media routes) and the Stripe + auth stack three times (~510 KB × 3 billing
routes). Group sibling actions that share heavy dependencies behind one
dynamic-segment route file; the public URLs do not change:

```
app/api/media/[action]+api.ts      → /api/media/list, /api/media/getUploadUrl,
                                      /api/media/getSignedUrls, /api/media/delete
app/api/billing/[action]+api.ts    → /api/billing/summary, /api/billing/checkout-session,
                                      /api/billing/portal-session
app/api/billing/webhook+api.ts     → /api/billing/webhook (static — see below)
```

The dispatcher shape (from `app/api/media/[action]+api.ts`): map each action
to its per-method handlers, return a typed `404 not-found` for unknown
actions and `405 method-not-allowed` for a known action with the wrong
method, matching what the router would have returned for separate files:

```ts
const routes: Record<string, Partial<Record<Method, RouteHandler>>> = {
  list: { GET: mediaHandlers.list },
  getUploadUrl: { POST: mediaHandlers.getUploadUrl },
  getSignedUrls: { POST: mediaHandlers.getSignedUrls },
  delete: { DELETE: mediaHandlers.deleteOne, POST: mediaHandlers.deleteMany },
};

export function GET(request: Request, params: { action: string }) {
  return dispatch("GET", request, params);
}
```

Rules of thumb:

- Consolidate routes that share the same feature prefix, auth model, and
  heavy dependencies. Keep the handler bodies in `server/` modules
  (`server/media/handlers.ts`, `server/api/billing/handlers.ts`) so the
  route file stays a thin dispatcher.
- Keep a route **separate** when its auth model differs. The Stripe webhook
  stays in static `webhook+api.ts` (signature over the raw body, no user
  token); Expo Router matches static routes before dynamic siblings, so it
  wins over `[action]+api.ts`.
- Tiny routes with no shared heavy deps (the `app/api/template/*` demos)
  aren't worth consolidating.
- Don't fake sub-routes by dispatching on the request body or query params —
  you lose per-endpoint status semantics and rate-limit/path alignment for
  no additional size win over a dynamic segment.

File-name → URL mapping, verified against both the dev server and the
exported build:

| File | Matches | Notes |
|------|---------|-------|
| `api/media/index+api.ts` | `/api/media` only | The folder URL itself; does NOT catch sub-paths |
| `api/media/[action]+api.ts` | `/api/media/<one-segment>` | Param arrives as `params.action`; single segment only |
| `api/billing/webhook+api.ts` | `/api/billing/webhook` | Static; wins over a dynamic sibling |

All three can coexist in one folder (REST shape: `index` for the
collection, `[id]`/`[action]` for items, static files for exceptions).
Each file is still its own server bundle — an `index+api.ts` next to
action files adds a bundle rather than consolidating anything, so the
size win comes only from routes sharing one file.

## Data Loaders

Loaders let a web route declare its initial data as server code instead of a
client `useEffect`. The pattern has three parts.

**When loaders run.** Because routes are client-rendered (no
`unstable_useServerRendering`), loader data is not embedded in the HTML shell:
`useLoaderData` fetches `/_expo/loaders/<route>` after mount. The dev server
answers that request by running the loader per request. `expo export`
answers it with a **build-time snapshot** — it runs every loader once during
the export and writes the result to `dist/client/_expo/loaders/<route>`. So in
a production build, loader output is as fresh as the last deploy, and
`request` is absent inside the loader (`getTemplateServerStatus` reports
`method: "STATIC"`). Anything that must be request-scoped or fresh belongs in
an API route, which does run per request in production.

**Static routes only.** The snapshot is keyed by the route's file path, so a
route like `[example].tsx` is exported as `_expo/loaders/.../[example]` while
the browser asks for `_expo/loaders/.../dynamic-loader`. A loader on a param'd
route therefore resolves in dev and 404s in a production build. Give param'd
routes an API route and fetch it from the screen — that is what the demo's
`[example].tsx` does (no `loader` export;
`client/features/server-alpha/ServerAlphaExampleScreen.tsx` reads
`useLocalSearchParams()` and fetches `/api/template/examples`).

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

Re-export from the route file under the name `loader`, next to the screen
(`app/(main)/(demos)/server-alpha/index.tsx`):

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

- Loaders belong on static routes. Param'd routes fetch an API route.
- Loaders are read-only. Mutations belong in API route handlers.
- Wrap `setResponseHeaders` in try/catch; the export pass and unit tests run
  loaders without an active request scope.
- Never derive auth or per-user data from a loader — its production output is
  a single build-time snapshot served to everyone.
- Pair each loader with an API route exposing the same data so the client can
  refetch live values (`serverAlphaLoader` pairs with
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

## Replication Checklist

Use this order when adding the server stack to another Expo Router project:

1. Set `web.output: "server"` and the two `unstable_` router flags in app
   config; confirm the Expo SDK version supports them.
2. Add a server entry (`server.bun.ts` or `server/index.ts` equivalent) that
   wraps the `expo-server` adapter and owns CORS, rate limits, security
   headers, and static caching.
3. Create `server/api/shared/` with the CORS, error, and auth helpers; keep
   route files thin handler exports.
4. Add API routes under `app/api/**/+api.ts` with `OPTIONS` preflight and
   CORS headers on every response. Consolidate sibling actions that share
   heavy dependencies behind a `[action]+api.ts` dispatcher (see Route
   Consolidation above) — each `+api.ts` exports as its own bundle.
5. Add `app/+middleware.ts` with an explicit matcher, limited to headers and
   observability.
6. Add loaders per feature folder for **static** routes, re-export as `loader`
   from the route file, consume with `useLoaderData<typeof loaderFn>()`, and
   pair each with an API route for client refetch. Param'd routes read their
   params and fetch that API route.

## Validation

```bash
bun run typecheck
bun run lint
bun run test:ci
bun run build
bun run start   # then load a loader-backed route and curl an API route
```

For loader and API behavior, test the underlying server modules directly
(see `app/api/template/__tests__/` and `server/api/shared/__tests__/`) and
verify loader-backed pages render expected data in the running app.
