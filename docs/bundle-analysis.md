# Bundle Size Analysis

## Commands

| Command | Does |
|---------|------|
| `bun run analyze` | `build-web` (export with sourcemaps), then `source-map-explorer` over `dist/client/_expo/static/js/web/*.js` — a treemap of every module the browser loads, ignoring `dist/server/` |
| `bun run analyze:gzip` | Same, sized gzipped |
| `bun run build && bun run bundle-size` | Compare `dist/client` JS against the baseline |
| `bun run build && bun run bundle-size --update` | Rewrite the baseline; commit the result |

## Baseline

`scripts/check-bundle-size.js` sums every `.js` file under `dist/client` except
the known optional lazy chunks (`heic2any-*`, `VideoThumbnails-*`) and compares
the total to `totalBytes` in `scripts/bundle-baseline.json`. Growth beyond
`THRESHOLD` (`0.10`, a constant at the top of the script) exits 1.

Current baseline: 4,474,265 bytes of budgeted client JS.

The metric sums *every* budgeted chunk, so it barely moves when code is split out
of the entry — it guards against new dependency weight, not against poor
splitting. For what a single route downloads, compare individual chunk sizes and
the `<script>` set in that route's exported HTML.

Run the check before merging changes to dependencies, asset loading, routing, or
build output.

## Route Code Splitting (web)

`app.config.ts` passes `asyncRoutes: { web: "production" }` to the `expo-router`
plugin, so a production web export gives each route its own chunk instead of
inlining every route into the entry. A route's exported HTML eagerly loads the
Metro runtime, its layout chunks, its own route chunk, the shared `__common-*`
chunk, and `entry-*`; other routes and their route-only dependencies (e.g.
`zod`, `react-hook-form`) load on navigation.

Dev servers and native builds are unaffected: `"production"` is web-only and no
other platform is in the option object.

## The One-Split-Point Rule

**Metro hoists any module reachable from two or more async chunks into
`__common`, which every route loads eagerly. A shared-but-optional graph stays
lazy only behind exactly one `import()` specifier.** Several `import()` calls are
fine as long as they all resolve to the *same* module — that is one chunk.

Reaching for narrower entry points from separate `import()` calls is the trap:
three specifiers under `aws-amplify` shared one internal graph, so ~124 kB of
`@aws-amplify/core` + `@aws-amplify/auth` (~489 kB raw / ~103 kB gzip once
transitive deps are counted) was hoisted into `__common` and downloaded before
first render by every visitor, including Clerk-only and auth-disabled deploys.

The pattern: one barrel module that nothing in the eager graph imports, reached
through one `import()` specifier by every consumer.

| Barrel | Consumers | Weight kept out of `__common` |
|--------|-----------|-------------------------------|
| `client/features/auth/provider/clerkClient` (statically imports `@clerk/clerk-expo`, re-exports `ClerkProviderBoundary`) | `AuthProviderGate`, `getAuthClient()` | Clerk SDK + `swr` + `expo-auth-session` (~280 kB) |
| `client/features/auth/provider/cognitoSdk` (statically imports `aws-amplify`, `aws-amplify/utils`, `aws-amplify/auth`, re-exports `Amplify` / `Hub` / `amplifyAuth`) | `cognitoClient.ts`, via one `await import("./cognitoSdk")` | the `aws-amplify` cluster |
| `client/features/auth/components` | `AuthGate`, `(demos)/auth-demo`, `client/showcase/ShowcaseScreen` | auth screen + 5 forms (~47 kB raw, ~14 kB gzip) |
| `client/showcase/gallery`, via `client/showcase/lazyGallery` | Explore tab rail + block spotlight, `(demos)/showcase`, `themed-showcase`, `components`, `components/[id]`, `blocks` | the showcase cluster: previews of all 36 components, the kitchen sink, component details, block stages, plus the web engines only they reach (`vaul`, Radix select/menu/dialog/popover/tooltip, `@floating-ui`, `react-remove-scroll`) — ~575 kB raw / ~141 kB gzip as the `gallery-*` chunk; `__common` went from 906 kB to 504 kB raw |

Adding a *static* import of one of those barrels — or a second `import()` with a
different specifier for the same file — silently moves the whole graph back into
`__common`; nothing fails at runtime. Source-level guards, since only a full web
export can observe the regression directly:

- `client/features/auth/__tests__/cognitoSdk.guardrail.test.ts`
- `client/features/auth/components/__tests__/authComponentsSplitPoint.test.ts`
- `client/showcase/__tests__/gallerySplitPoint.test.ts`

To check a boundary by hand, look for its sources in the `__common-*.js.map`
sourcemap after `bun run build-web`.

The gallery adds one layer over the auth barrels: `lazyGallery.tsx` holds the ONE
`import()` of `gallery.tsx` and exposes `React.lazy` wrappers (`LazyPreview`,
`LazyBlockStage`, `GalleryRoute`). The five gallery route files under
`app/(main)/(demos)` are one-line shells over `GalleryRoute`; their bodies live in
`client/showcase/*Screen.tsx` and are imported statically only from
`gallery.tsx`. Server rendering resolves the lazy boundary synchronously, so the
streamed HTML already carries the previews and the browser hydrates them when the
chunk lands.

## Platform Files Instead of `Platform.OS` Branches (web)

Metro registers every `import()` it can see as an async chunk, whichever branch
it sits in, so a static import in one route plus a dynamic import somewhere else
is two chunks reaching one module — which hoists it into `__common`. A
`.native.ts` sibling keeps the native path out of the web graph entirely:

- `packages/media/src/processing/videoThumbnailDeps.native.ts` holds the
  `import("expo-video")` / `import("expo-image-manipulator")` for native
  thumbnails; the web sibling has no imports. Without it `expo-video` sat in
  `__common` for every route even though only the media tab plays video.
- `client/features/billing/hooks/browserHandoff.native.ts` is billing's only
  importer of `expo-web-browser`; web navigates with `window.location`. The
  package now lives solely in the lazy Clerk chunk.

For built package output, the suffix must be listed in `platformSuffixes` in
`scripts/fix-package-esm.mjs` (`ui`: `native`, `web`, `ios`, `android`; `media`:
`native`) so the built specifier stays extension-less — Metro resolves an
explicit `./foo.js` to that exact file and never considers `foo.native.js`.

## Sentry on Web

`client/lib/sentry.web.ts` replaces the RN SDK with `@sentry/react` (the same
version the RN SDK pins) and defers the chunk fetch to `requestIdleCallback`
(3 s cap) so it never competes with hydration; global errors thrown before the
SDK is up are buffered and forwarded after `init`. The lazy Sentry chunk went
from ~706 kB to ~521 kB raw (~128 kB gzip). See `docs/error-tracking.md`.

## Common Large Dependencies

Watch for these in `source-map-explorer`:

| Package | Typical size | Notes |
|---------|--------------|-------|
| `aws-amplify` | ~510 kB raw / ~105 kB gzip | Lazy in the `cognitoSdk-*` chunk; keep it to one split point |
| `zod` | ~475 kB raw in the `screen-form-*` chunk | `import * as z from "zod/mini"` is a namespace import, so tree shaking keeps every export: all locales, `toJSONSchema`, `zod/v4/core`. Lazy (form routes only), but named imports would let the optimizer drop most of it |
| `react-hook-form` | ~43 kB | Form state |
| `@rn-primitives/*` | ~5–10 kB each | 18 packages, declared in `packages/ui/package.json` |
