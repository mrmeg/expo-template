# Expo Server Guide

This guide is the LLM-facing reference for replicating this template's server
stack — server-rendered web output, API routes, request middleware, and data
loaders — in another Expo Router project. Server rendering, data loaders, and
middleware are Expo Router alpha features behind `unstable_` flags (the demos
call this surface "Server Alpha"); expect their APIs to move between SDK
versions, and check the pinned Expo version in `package.json` before copying
patterns.

## Source Map

| Concern | Source |
|---------|--------|
| Server output and router flags | `app.config.ts` |
| HTML document (server-rendered per request) | `app/+html.tsx` |
| SSR stylesheet flush | `client/features/app/SsrStyleFlush.tsx` |
| SSR request-derived state | `server/lib/ssrViewport.ts`, `server/lib/ssrOnboarding.ts`, `client/features/app/ssrViewportMetrics.ts` |
| Production server (Bun) | `server.bun.ts` |
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
`dynamic-loader` (a param'd route fetches the matching API route instead of
declaring a loader — see Data Loaders), `api-route`
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
      unstable_useServerRendering: true,
      unstable_useServerMiddleware: true,
      unstable_useServerDataLoaders: true,
    },
  ],
],
```

- `output: "server"` makes `expo export -p web` emit `dist/client` (static
  assets) plus `dist/server` (request handler, route manifest, API routes, and
  — with server rendering on — the SSR render module).
- `unstable_useServerRendering` renders each web route on the server per
  request instead of writing an HTML shell at export time (see Server
  Rendering below).
- `unstable_useServerMiddleware` enables `app/+middleware.ts`.
- `unstable_useServerDataLoaders` enables route `loader` exports and
  `useLoaderData`.

### Server Rendering

With `unstable_useServerRendering` on, `expo export -p web` skips HTML
prerendering entirely: it emits `dist/server/_expo/server/render.js` and marks
`dist/server/_expo/routes.json` with `"rendering": { "mode": "ssr" }` (the
export log prints "Server rendering is enabled"). At runtime `expo-server`
streams that renderer per request, so every response carries the route's real
markup — crawlers and the first paint see page content, not a shell (page-level
meta still comes from `client/components/Seo.tsx`).

Server rendering is not free: the first render happens in Node, with no DOM and
no browser storage. Four things in this template exist only to satisfy that.

- **Styles must be registered at module scope.** The framework's head snapshot
  (`useServerDocumentContext()`) is taken *before* route modules load, so any
  react-native-web rule registered later is missing from it and the HTML
  references classes with no rules. `createThemedStyles` hoists rules to module
  scope, and `client/features/app/SsrStyleFlush.tsx` renders last in the root
  layout — after the whole subtree — to emit the complete
  `StyleSheet.getSheet()` output as a React 19 style resource.
- **`app/+html.tsx` filters the snapshot.** It drops the framework's
  `<style id="react-native-stylesheet">` node from `headNodes` and renders an
  empty element with that id for react-native-web to adopt as its client
  sheet. Both sheets use single-class selectors, so keeping the incomplete
  snapshot would let its base resets win the cascade over later atomics.
- **First-render state comes off the request.** `server/lib/ssrViewport.ts`
  derives a viewport width from a `mrmeg-vw` cookie, then a User-Agent
  heuristic, then a desktop default (without it react-native-web lays out at
  width 0). `server/lib/ssrOnboarding.ts` reads a `has-seen-onboarding`
  cookie. Both are mirrors of client state, not sources of truth, and
  `client/features/app/ssrViewportMetrics.ts` re-derives the same values from
  the same bytes so hydration matches. A request with no cookies renders the
  onboarding variant.
- **Dev SSR shares one React copy.** Expo externalizes `react` and `react-dom`
  in `node`/`react-server` dev bundles, so `metro.config.js` skips its dedupe
  rewrite for those packages there; rewriting them would bundle a second React
  and give externalized packages a null hooks dispatcher.

## Serve The Build

Development: `bun run web` (Expo dev server renders routes and runs loaders,
middleware, and API routes in place).

Production: `bun run build` exports `dist/`, then `bun run start` serves it:

- `bun run start` — `server.bun.ts`, the only production entry. Wraps
  `createRequestHandler({ build: "dist/server" })` from
  `expo-server/adapter/bun` in `Bun.serve`.
- `bun run start-local` — the same entry with `.env` autoloaded by Bun.

The entry owns concerns that Expo's request handler does not:

- CORS origin allowlist from the `ALLOWED_ORIGINS` env var (comma-separated;
  localhost defaults otherwise), echoing only allowlisted origins and managing
  `Vary: Origin`.
- Per-IP rate-limit buckets defined in `server/rateLimits.js`: general
  (500/15 min), media signing (60/min), strict (10/min).
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Request-ID`, and HSTS in
  production.
- Static caching and compression: 1-year cache for `/_expo/static/` and
  `/assets/`, brotli/gzip for text-like bodies over 1KB, with compressed
  bodies cached in memory.
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

**When loaders run.** With server rendering on there is no build-time
snapshot. For an HTML request, `expo-server` runs the matched route's loader
**per request** — with the real request and parsed params — before rendering,
hands the result to the render through Expo Router's server loader context so
`useLoaderData()` returns it during the server render, and injects the same
payload into the bootstrap script so hydration reuses it without a fetch.
Client-side navigations (and loader invalidation) fetch
`/_expo/loaders/<route>`, which the request handler answers by running the
loader again, per request. So loader output is as fresh as the request, and
`request` is present inside the loader.

**Declare the loader in the route file.** `expo export` decides which routes
have loaders from a Babel pass over `app/` (`babel-preset-expo`'s
`server-data-loaders-plugin`) that only recognizes a `loader` **declaration** in
the route file: `export const loader = …` or `export function loader…`. Export
specifiers are skipped, so `export { serverAlphaLoader as loader } from "…"`
silently ships no loader — no loader bundle, no `loader` entry in
`dist/server/_expo/routes.json`, `/_expo/loaders/<route>` 404s, and the server
render falls through to `useLoaderData`'s client fetch, which throws
`TypeError: fetch() URL is invalid` inside the route's Suspense boundary.
Development hides it, because the dev server marks every HTML route as having a
loader. `server/__tests__/loaderExportShape.test.ts` guards the shape.

On a loader route, declare the screen's default export too. The plugin drops a
route's `export default` declaration from the loader bundle, but an
`export { default } from "…"` specifier line survives and drags the whole
screen graph into that server bundle — 1.2 MB versus 15 KB for this demo.
Loader-less routes keep the one-line `export { default } from "…"` convention;
only routes that emit a loader bundle pay for it.

**Param'd routes.** Loader requests are matched against the route manifest by
the route's regex with params parsed out, so a param'd loader is addressable
under server rendering (the older build-time snapshot, keyed by the literal
file path, could not be). The demo still keeps the API-route split, which
works on every rendering mode: `[example].tsx` exports no `loader`, and
`client/features/server-alpha/ServerAlphaExampleScreen.tsx` reads
`useLocalSearchParams()` and fetches `/api/template/examples`.

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
    // Unit tests and direct calls do not have an active Expo Server
    // request scope.
  }
  const { getTemplateServerCatalog } = await import("@/server/api/template/examples");
  return getTemplateServerCatalog(request);
};
```

Declare both exports in the route file, next to each other
(`app/(main)/(demos)/server-alpha/index.tsx` is the whole file):

```ts
import { serverAlphaLoader } from "@/client/features/server-alpha/loaders";
import ServerAlphaDemoScreen from "@/client/features/server-alpha/ServerAlphaDemoScreen";

export const loader = serverAlphaLoader;
export default ServerAlphaDemoScreen;
```

The route file stays thin and both declarations are ones the export
understands: it strips `loader` (and the loader-only module graph behind it)
from the client bundle, and strips the screen from the loader bundle. Specifier
re-exports for either export are silently dropped or silently fat — see above.

Consume in the screen with `useLoaderData`, typed by the loader itself:

```ts
import { useLoaderData } from "expo-router";

const catalog = useLoaderData<typeof serverAlphaLoader>();
```

Loader rules:

- Declare `loader` (and the screen's `default`) in the route file. Specifier
  re-exports are invisible to the export's loader detection.
- Loaders are read-only. Mutations belong in API route handlers.
- Wrap `setResponseHeaders` in try/catch; unit tests and direct calls run
  loaders without an active request scope.
- Keep authorization in API routes. A loader does see the request under server
  rendering, but its data must stay fetchable from the client too (next rule),
  so the API route is the single place that can own the check for both paths.
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

1. Set `web.output: "server"` and the three `unstable_` router flags in app
   config; confirm the Expo SDK version supports them. Server rendering adds
   the first-render constraints listed under Server Rendering — budget for the
   stylesheet flush, the `+html.tsx` snapshot filter, and request-derived
   viewport/persisted state before turning it on.
2. Add a server entry (`server.bun.ts`, or the `expo-server` adapter for your
   runtime) that wraps the request handler and owns CORS, rate limits,
   security headers, and static caching.
3. Create `server/api/shared/` with the CORS, error, and auth helpers; keep
   route files thin handler exports.
4. Add API routes under `app/api/**/+api.ts` with `OPTIONS` preflight and
   CORS headers on every response. Consolidate sibling actions that share
   heavy dependencies behind a `[action]+api.ts` dispatcher (see Route
   Consolidation above) — each `+api.ts` exports as its own bundle.
5. Add `app/+middleware.ts` with an explicit matcher, limited to headers and
   observability.
6. Add loaders per feature folder, consume with
   `useLoaderData<typeof loaderFn>()`, and pair each with an API route for
   client refetch. Declare the `loader` and `default` exports in the route
   file, never as specifier re-exports (see Data Loaders).

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
