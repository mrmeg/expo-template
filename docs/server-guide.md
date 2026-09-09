# Expo Server Guide

Reference for replicating this template's server stack — server-rendered web output, API routes, request middleware, data loaders — in another Expo Router project. Server rendering, loaders, and middleware are Expo Router alpha features behind `unstable_` flags (the demos call this surface "Server Alpha"); their APIs move between SDK versions, so check the pinned Expo version in `package.json` before copying.

## Source Map

| Concern | Source |
|---------|--------|
| Server output and router flags | `app.config.ts` |
| HTML document (server-rendered per request) | `app/+html.tsx` |
| SSR stylesheet flush | `client/features/app/SsrStyleFlush.tsx` |
| Ordered bootstrap scripts (patch) | `patches/@expo%2Frouter-server@57.0.9.patch`, pinned in `package.json` `patchedDependencies` |
| Not-found route (served at 404) | `app/+not-found.tsx` |
| SSR hydration guardrails | `__tests__/ssrHydration.guardrail.test.ts` |
| SSR request-derived state | `server/lib/ssrViewport.ts`, `server/lib/ssrOnboarding.ts`, `client/features/app/ssrViewportMetrics.ts` |
| Production server (Bun) | `server.bun.ts` |
| Rate-limit buckets | `server/rateLimits.js` |
| Request middleware | `app/+middleware.ts` |
| Data loaders, demo screens, pattern data | `client/features/server-alpha/loaders.ts`, `ServerAlphaDemoScreen.tsx`, `ServerAlphaExampleScreen.tsx`, `server/api/template/examples.ts` |
| Loader export-shape guardrail | `server/__tests__/loaderExportShape.test.ts` |
| Loader-backed route / param'd route (API-fetched) | `app/(main)/(demos)/server-alpha/index.tsx`, `[example].tsx` |
| API routes | `app/api/**/+api.ts` |
| Shared API helpers (CORS, errors, auth) | `server/api/shared/` |

Route `/server-alpha` demos four patterns: `loader-overview` (a static route's loader supplies its page data), `dynamic-loader` (a param'd route fetches its API route instead of declaring a loader), `api-route` (parsing and mutations), `middleware` (request-scoped headers only).

## Enable Server Output

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
      asyncRoutes: { web: "production" },
    },
  ],
],
```

- `output: "server"` makes `expo export -p web` emit `dist/client` (static assets) plus `dist/server` (request handler, route manifest, API routes, and — with server rendering on — the SSR render module).
- `unstable_useServerRendering` renders each web route on the server per request instead of writing an HTML shell at export time.
- `unstable_useServerMiddleware` enables `app/+middleware.ts`.
- `unstable_useServerDataLoaders` enables route `loader` exports and `useLoaderData`.
- `asyncRoutes: { web: "production" }` emits per-route chunks on web production exports; omitting `ios`/`android`/`default` keeps dev servers and native builds synchronous.

### Server Rendering

Export skips HTML prerendering: it emits `dist/server/_expo/server/render.js` and marks `dist/server/_expo/routes.json` with `"rendering": { "mode": "ssr", "file": "_expo/server/render.js" }` (export log: "Server rendering is enabled"). `expo-server` streams that renderer per request, so every response carries the route's real markup. Page-level meta still comes from `client/components/Seo.tsx`.

The first render runs in Node: no DOM, no browser storage. Six constraints follow.

- **Register styles at module scope.** The framework's head snapshot (`useServerDocumentContext()` → the `<style id="react-native-stylesheet">` node) is taken before route modules load, so later-registered rules are missing and the HTML references classes with no rules — unstyled paint until hydration. It misses whenever the module cache is cold: every dev request, and the first request after a production cold start. `createThemedStyles` hoists rules to module scope. `client/features/app/SsrStyleFlush.tsx` renders last in the root layout, after the whole subtree, so `StyleSheet.getSheet()` sees every rule the page uses; it emits them as a React 19 style resource (`href` + `precedence`) and renders nothing on the client (resources dedupe by `href` outside the reconciled tree, so hydration still matches).
- **The flush doubles atomic selectors** (`hardenFlushedSheet`: `.r-x` → `.r-x.r-x`). React hoists the flushed node into the head preamble, ahead of `app/+html.tsx`, so the client sheet wins ties — required, because the flush carries classic base resets that would zero out client-only atomics. react-native-web fills the client sheet with resets at bundle boot while a route's atomics arrive only with its async chunk; two-class specificity holds the flushed atomics across that gap. Classic `.css-*` resets, element rules, group markers, and keyframes stay single-class so client atomics beat them.
- **`app/+html.tsx` filters the snapshot.** It drops the framework's `<style id="react-native-stylesheet">` node from `headNodes` and renders exactly one empty element with that id for react-native-web to adopt as its client sheet. Head order: filtered nodes, anchor, scripts. Both sheets are single-class, so keeping the snapshot would let its resets win over later atomics.
- **Order the bootstrap scripts.** React emits `bootstrapScripts` as `<script async>`, so runtime, common, entry, layout, and route chunks execute in download order; a route chunk running before the Metro prelude has no `__d` and is refetched on demand. `patches/@expo%2Frouter-server@57.0.9.patch` (applied by `bun install` through `patchedDependencies`) preloads every chunk from the head and inserts them from one inline script with `async = false`. On a version change: `bun patch @expo/router-server`, re-apply the edit marked `PATCH(expo-template)`, `bun patch --commit`. The guardrail test fails while the pinned and installed versions disagree.
- **Take first-render state off the request.** `server/lib/ssrViewport.ts` derives a viewport width from a `mrmeg-vw` cookie, then a User-Agent heuristic, then a desktop default (without it react-native-web lays out at width 0). `server/lib/ssrOnboarding.ts` reads a `has-seen-onboarding` cookie, where only `"1"` counts as seen. Each module exports a request form for loaders (`detectSsrViewportWidth`, `detectOnboardingSeen`) and an ambient form reading `expo-server`'s request scope (`detectSsrViewportFromRequestScope`, `detectOnboardingSeenFromRequestScope`). The app uses the ambient form: both values land in the root layout (`SafeAreaProvider`'s `initialMetrics`, the onboarding gate), and layouts cannot export loaders. `requestHeaders()` throws with no active scope, so both modules try/catch to their default (desktop, `false`). Never cache the viewport in module scope — concurrent requests at different widths would overwrite it. Both cookies mirror client state, not sources of truth: `client/features/app/ssrViewportMetrics.ts` re-derives the same values from the same bytes so hydration matches. A request with no cookies renders the onboarding variant.
- **Dev SSR shares one React copy.** Expo externalizes `react` and `react-dom` in `node`/`react-server` dev bundles, so `metro.config.js` skips its dedupe rewrite for those packages there; rewriting them would bundle a second React and give externalized packages a null hooks dispatcher.

Two route-level rules follow. `expo-server` answers every unmatched `GET` with `+not-found` at status 404, so `app/+not-found.tsx` must render a real page — `ErrorScreen` from `client/templates/error/Screen.tsx`, `variant="not-found"`, "Go home" action — not a redirect; a 404 body that bounces to `/` reads as a soft redirect to crawlers. And each web path must map to exactly one route file: the server-side matcher keeps "previous segments" in a process-wide store, so two files matching one path flip between requests. Platform variants like `_layout.web.tsx` are fine.

## Serve The Build

| Command | Runs |
|---------|------|
| `bun run web` | `expo start --web` — dev server renders routes and runs loaders, middleware, and API routes in place |
| `bun run build` | `expo export -p web --output-dir dist` with an 8 GB Node heap |
| `bun run start` | `bun ./server.bun.ts`, the production entry |
| `bun run start-local` | Same entry, `.env` autoloaded |
| `bun run serve:ssr` | `expo serve` — local preview of `dist/` without the Bun entry's layers |

`server.bun.ts` wraps `createRequestHandler({ build: "dist/server" })` from `expo-server/adapter/bun` in `Bun.serve` and serves `dist/client` statics. It owns what Expo's request handler does not:

- CORS origin allowlist from `ALLOWED_ORIGINS` (comma-separated; localhost defaults otherwise), echoing only allowlisted origins and managing `Vary: Origin`.
- Per-IP rate-limit buckets from `server/rateLimits.js`: general 500/15 min (all `/api`), media signer 60/min (`/api/media/getUploadUrl`), strict 10/min (`/api/reports`, `/api/corrections`, both billing session routes; the Stripe webhook is excluded, since it bursts retries faster and its signature check gates abuse). A listed path that stops matching its real route silently downgrades to the general bucket.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Request-ID`, and HSTS in production.
- Static caching and compression: 1-year immutable cache for `/_expo/static/` and `/assets/` (1 hour otherwise), brotli/gzip for text-like bodies of 1 KB or more, compressed bodies cached in memory.
- Loader path normalization: strips `.web`/`.native` suffixes from `GET`/`HEAD` `/_expo/loaders/*` requests so platform-specific loader files resolve.

## API Routes

Route files live at `app/api/**/<name>+api.ts` and export HTTP-method handlers. Keep them thin — parsing, validation, and domain logic live in `server/` modules. Canonical shape (`app/api/template/status+api.ts`):

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
| `cors.ts` | `getCorsHeaders(request)`, `getPreflightHeaders(request)`, `sanitizeErrorDetails` (production error redaction) |
| `errors.ts` | `jsonErrorResponse`, `unauthorizedResponse`, `forbiddenResponse`, `badRequestResponse` — typed `{ code, message }` bodies with CORS applied |
| `auth.ts` | `requireAuthenticatedUser(request)` returns `{ ok: true, user } \| { ok: false, response }`; fails closed with 401 when no verifier is bootstrapped |
| `authBootstrap.ts`, `cognitoTokenVerifier.ts`, `clerkTokenVerifier.ts` | `ensureAuthBootstrapped` registers a process-wide token verifier at startup; tests reset with `setTokenVerifier(null)` / `resetAuthBootstrap()` |

Optional features must fail closed: missing env returns a typed disabled response (the media routes' `503 media-disabled`), never a crash.

### Route Consolidation (Bundle Size)

`expo export` emits every `+api.ts` file as its own **self-contained server bundle**, so sibling routes duplicate every shared dependency. Group siblings sharing heavy dependencies behind one dynamic-segment route file; the public URLs do not change. In `dist/server/_expo/functions/`, `api/media/[action]+api.js` is one 260 KB bundle for four actions, `api/billing/[action]+api.js` one 512 KB bundle for three.

```
app/api/media/[action]+api.ts      → /api/media/list, /api/media/getUploadUrl,
                                      /api/media/getSignedUrls, /api/media/delete
app/api/billing/[action]+api.ts    → /api/billing/summary, /api/billing/checkout-session,
                                      /api/billing/portal-session
app/api/billing/webhook+api.ts     → /api/billing/webhook (static — see below)
```

Dispatcher shape (`app/api/media/[action]+api.ts`): map each action to its per-method handlers, return a typed `404 not-found` for unknown actions and `405 method-not-allowed` for a known action with the wrong method — what the router would have returned for separate files.

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

- Consolidate routes sharing a feature prefix, auth model, and heavy dependencies. Keep handler bodies in `server/` modules (`server/media/handlers.ts`, `server/api/billing/handlers.ts`) so the route file stays a thin dispatcher.
- Keep a route **separate** when its auth model differs. The Stripe webhook stays in static `webhook+api.ts` (signature over the raw body, no user token); Expo Router matches static routes before dynamic siblings, so it wins over `[action]+api.ts`.
- Tiny routes with no shared heavy deps (the `app/api/template/*` demos) aren't worth consolidating.
- Don't fake sub-routes by dispatching on request body or query params — you lose per-endpoint status semantics and rate-limit/path alignment for no size win over a dynamic segment.

File-name → URL mapping:

| File | Matches |
|------|---------|
| `api/<feature>/index+api.ts` | `/api/<feature>` only — the folder URL itself, never sub-paths |
| `api/<feature>/[action]+api.ts` | `/api/<feature>/<one-segment>`; param arrives as `params.action` |
| `api/<feature>/<name>+api.ts` | `/api/<feature>/<name>` — static, wins over a dynamic sibling |

All three can coexist in one folder (`index` for the collection, `[id]`/`[action]` for items, static files for exceptions). Each file is still its own bundle — an `index+api.ts` beside action files adds one rather than consolidating, so the size win comes only from routes sharing a file.

## Data Loaders

A loader declares a web route's initial data as server code instead of a client `useEffect`.

**When loaders run.** There is no build-time snapshot. For an HTML request, `expo-server` runs the matched route's loader **per request** — with the real request and parsed params — before rendering, passes the result through Expo Router's server loader context so `useLoaderData()` returns it during the server render, and injects the same payload into the bootstrap script so hydration reuses it without a fetch. Client-side navigations and loader invalidation fetch `/_expo/loaders/<route>`, answered by running the loader again. Loader output is as fresh as the request, and `request` is present inside the loader.

**Declare the loader in the route file.** `expo export` decides which routes have loaders from a Babel pass over `app/` (`babel-preset-expo`'s `server-data-loaders-plugin`) recognizing only a `loader` **declaration** in the route file: `export const loader = …` or `export function loader…`. Export specifiers are skipped, so `export { serverAlphaLoader as loader } from "…"` silently ships no loader — no loader bundle, no `loader` entry in `dist/server/_expo/routes.json`, `/_expo/loaders/<route>` 404s, and the server render falls through to `useLoaderData`'s client fetch, which throws `TypeError: fetch() URL is invalid` inside the route's Suspense boundary. Development hides it: the dev server marks every HTML route as having a loader. `server/__tests__/loaderExportShape.test.ts` guards the shape.

Declare the screen's default export on a loader route too. The plugin drops a declared `export default` from the loader bundle, but an `export { default } from "…"` specifier line survives and drags the whole screen graph in — roughly 1.2 MB against the 15 KB this demo's loader bundle ships. Loader-less routes keep the one-line `export { default } from "…"` convention.

**Param'd routes.** Loader requests are matched against the route manifest by the route's regex with params parsed out, so a param'd loader is addressable under server rendering. The demo still keeps the API-route split, the one data path working on every rendering mode including native and a static web export: `[example].tsx` exports no `loader`, and `client/features/server-alpha/ServerAlphaExampleScreen.tsx` reads `useLocalSearchParams()` and fetches `/api/template/examples`.

Define loaders in a feature folder, typed with `LoaderFunction<T>`. Dynamically import server modules inside the loader body so server-only code stays out of the client bundle (`client/features/server-alpha/loaders.ts`):

```ts
import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";

export const serverAlphaLoader: LoaderFunction<TemplateServerCatalog> = async (request) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // No active Expo Server request scope in unit tests or direct calls.
  }
  const { getTemplateServerCatalog } = await import("@/server/api/template/examples");
  return getTemplateServerCatalog(request);
};
```

With both exports declared, the export strips `loader` and its module graph from the client bundle and strips the screen from the loader bundle (`app/(main)/(demos)/server-alpha/index.tsx` in full):

```ts
import { serverAlphaLoader } from "@/client/features/server-alpha/loaders";
import ServerAlphaDemoScreen from "@/client/features/server-alpha/ServerAlphaDemoScreen";

export const loader = serverAlphaLoader;
export default ServerAlphaDemoScreen;
```

Consume in the screen, typed by the loader itself:

```ts
import { useLoaderData } from "expo-router";

const catalog = useLoaderData<typeof serverAlphaLoader>();
```

Loader rules:

- Declare `loader` and the screen's `default` in the route file. Specifier re-exports are invisible to loader detection.
- Loaders are read-only. Mutations belong in API route handlers.
- Wrap `setResponseHeaders` in try/catch; unit tests and direct calls run loaders without an active request scope.
- Keep authorization in API routes. A loader does see the request, but its data must stay fetchable from the client too, so the API route is the single place owning the check for both paths.
- Pair each loader with an API route exposing the same data so the client can refetch live values (`serverAlphaLoader` pairs with `app/api/template/examples+api.ts`).
- Return only JSON-serializable values — loader output crosses the server/client boundary.

## Request Middleware

`app/+middleware.ts` runs on matched server requests. Declare an explicit matcher and keep middleware to request-scoped headers and observability — auth decisions and mutations belong in route handlers:

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
    // The repo version also appends Origin to Vary when the request carries an
    // Origin header, for CORS-cache safety.
  });
};

export default middleware;
```

Match the route shapes your app serves: the repo file lists the grouped paths (`/(main)/(demos)/server-alpha`, `/(main)/(demos)/server-alpha/[example]`) alongside the public ones.

## Replication Checklist

1. Set `web.output: "server"` and the three `unstable_` router flags; confirm the SDK supports them. Budget for the Server Rendering constraints first — stylesheet flush, `+html.tsx` snapshot filter, request-derived viewport/persisted state, `@expo/router-server` bootstrap-order patch.
2. Add a server entry (`server.bun.ts`, or the `expo-server` adapter for your runtime) owning CORS, rate limits, security headers, and static caching around the request handler.
3. Create `server/api/shared/` with the CORS, error, and auth helpers; keep route files thin handler exports.
4. Add API routes under `app/api/**/+api.ts` with `OPTIONS` preflight and CORS headers on every response. Consolidate sibling actions sharing heavy dependencies behind a `[action]+api.ts` dispatcher — each `+api.ts` exports as its own bundle.
5. Add `app/+middleware.ts` with an explicit matcher, limited to headers and observability.
6. Add loaders per feature folder, consume with `useLoaderData<typeof loaderFn>()`, and pair each with an API route for client refetch. Declare the `loader` and `default` exports in the route file, never as specifier re-exports.

## Validation

```bash
bun run verify   # peer-check, typecheck, lint, check:features, registry + docs checks, jest --ci
bun run build
bun run start    # then load a loader-backed route and curl an API route
```

`bun run verify` skips the web build; individual gates are `bun run typecheck`, `lint`, `test:ci`, `check:features`. Test loader and API behavior through the server modules (`app/api/template/__tests__/`, `server/api/shared/__tests__/`), and confirm loader-backed pages render expected data in the running app.
