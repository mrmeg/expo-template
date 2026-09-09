# Bundle Size Analysis

## Quick Start

```bash
# Visualize the bundle (builds + opens source-map-explorer)
bun run analyze

# Check bundle size against baseline
bun run build && bun run bundle-size

# Set/update the baseline after intentional size changes
bun run build && bun run bundle-size --update
```

## How It Works

### `bun run analyze`

Builds the web export with source maps and opens `source-map-explorer` against
`dist/client/**/*.js`, showing a treemap of every module the browser loads. Use
this to identify large dependencies and dead code without counting the server
output in `dist/server/`.

### `bun run bundle-size`

Compares the total client JS bundle size in `dist/client` against the baseline
in `scripts/bundle-baseline.json`. Exits with code 1 if the bundle grew more
than 10% from the baseline.

The current checked-in baseline is 4,474,265 bytes of budgeted client JS
(every chunk except the optional `heic2any-*` conversion chunk) from the latest
local web export.

Note that the metric sums *every* client chunk, so it barely moves when code is
split out of the entry — it guards against new dependency weight, not against
poor splitting. Compare individual chunk sizes (and the `<script>` set in a
route's exported HTML) when you care about what a single route downloads.

### Setting the Baseline

Run after a clean build when you're happy with the current size:

```bash
bun run build
bun run bundle-size --update
```

This writes the current total to `scripts/bundle-baseline.json`. Commit the updated baseline.

## Local Bundle Guard

Run the bundle-size check before merging changes that affect dependencies,
asset loading, routing, or build output:

```bash
bun run build
bun run bundle-size
```

The command exits with code 1 if the bundle grows more than 10%.

## Route Code Splitting (web)

`app.config.ts` passes `asyncRoutes: { web: "production" }` to the `expo-router`
plugin, so a production web export splits each route into its own chunk instead
of inlining every route into the entry. A route's exported HTML eagerly loads
the metro runtime, its layout chunks, its own route chunk, the shared
`__common-*` chunk, and `entry-*`; everything else (other routes and their
route-only dependencies, e.g. `zod` and `react-hook-form`) loads on navigation.

Dev servers and native builds are unaffected — `"production"` is web-only, and
the other platforms are deliberately left out of the option object.

## Keeping an SDK Lazy: One Split Point Per Cluster

Metro hoists any module shared by two or more async chunks into `__common`,
which every route loads eagerly. A heavy dependency therefore stays lazy only if
it has **exactly one** split point. Multiple `import()` calls are fine as long
as they all resolve to the *same* module — they form one chunk.

The pattern used for both auth SDKs is a re-export module that nothing in the
eager graph imports:

- `client/features/auth/provider/clerkClient.ts` — statically imports
  `@clerk/clerk-expo` and re-exports `ClerkProviderBoundary`, so the ~280 kB
  Clerk cluster lives in one chunk.
- `client/features/auth/provider/cognitoSdk.ts` — statically imports
  `aws-amplify`, `aws-amplify/utils`, and `aws-amplify/auth` and re-exports
  them, so `cognitoClient.ts` reaches the SDK through a single
  `await import("./cognitoSdk")`.

Reaching for narrower entry points from separate `import()` calls is the trap:
three specifiers under `aws-amplify` used to share one internal graph, so ~124 kB
of `@aws-amplify/core` + `@aws-amplify/auth` (and ~489 kB raw / ~103 kB gzip of
cluster once transitive deps are counted) was hoisted into `__common` and
downloaded before first render by every visitor — including Clerk-only and
auth-disabled deploys. `client/features/auth/__tests__/cognitoSdk.guardrail.test.ts`
guards the arrangement at the source level, since only a full web export can
observe the regression directly.

## Manual Split Points (web)

Route splitting alone doesn't help for code several routes share: Metro hoists
any module reachable from two or more async chunks into the eagerly loaded
`__common` chunk, so shared-but-optional UI only stays lazy behind exactly one
split point. Two such boundaries exist today, and both work the same way —
one barrel module, one `import()` specifier, every consumer using it:

| Barrel | Consumers | Weight kept out of `__common` |
|--------|-----------|-------------------------------|
| `client/features/auth/provider/clerkClient` | `AuthProviderGate`, `getAuthClient()` | Clerk SDK + `swr` + `expo-auth-session` (~280 kB) |
| `client/features/auth/components` | `AuthGate`, `(demos)/auth-demo`, `client/showcase/ShowcaseScreen` | auth screen + 5 forms (~47 kB raw, ~14 kB gzip) |
| `client/showcase/gallery` (via `client/showcase/lazyGallery`) | Explore tab rail + block spotlight, `(demos)/showcase`, `themed-showcase`, `components`, `components/[id]`, `blocks` | the showcase cluster: previews of all 36 components, the kitchen sink, component details, block stages, plus the web engines only they reach (`vaul`, Radix select/menu/dialog/popover/tooltip, `@floating-ui`, `react-remove-scroll`) — ~575 kB raw / ~141 kB gzip as the `gallery-*` chunk; `__common` went from 906 kB to 504 kB raw |

The gallery split point works the same way as the auth ones but with an extra
layer: `lazyGallery.tsx` holds the ONE `import()` of `gallery.tsx` and exposes
`React.lazy` wrappers (`LazyPreview`, `LazyBlockStage`, `GalleryRoute`). The
five gallery route files under `app/(main)/(demos)` are one-line shells over
`GalleryRoute`; their bodies live in `client/showcase/*Screen.tsx` and are
imported statically only from `gallery.tsx`. Server rendering resolves the lazy
boundary synchronously, so the streamed HTML already carries the previews and
the browser hydrates them when the chunk lands.
`client/showcase/__tests__/gallerySplitPoint.test.ts` guards the invariant.

## Platform Files Instead of `Platform.OS` Branches (web)

Metro registers every `import()` it can see as an async chunk, whichever branch
it sits in, and a static import in one route plus a dynamic import somewhere
else is two chunks reaching one module — which hoists it into `__common`. Two
places use a `.native.ts` sibling so the web graph never sees the native path:

- `packages/media/src/processing/videoThumbnailDeps.native.ts` holds the
  `import("expo-video")` / `import("expo-image-manipulator")` for native
  thumbnails; the web sibling has no imports. Without it `expo-video` was in
  `__common` for every route even though only the media tab plays video.
- `client/features/billing/hooks/browserHandoff.native.ts` is the only importer
  of `expo-web-browser` for billing; web navigates with `window.location`. The
  package now lives solely in the lazy Clerk chunk.

`scripts/fix-package-esm.mjs` must list the suffix (`platformSuffixes`) for the
package so the built specifier stays extension-less — Metro resolves an explicit
`./foo.js` to that exact file and never considers `foo.native.js`.

## Sentry on Web

`client/lib/sentry.web.ts` replaces the RN SDK with `@sentry/react` (same
version the RN SDK pins) and defers the chunk fetch to `requestIdleCallback`
(3 s cap) so it never competes with hydration; global errors thrown before the
SDK is up are buffered and forwarded after `init`. The lazy Sentry chunk went
from ~706 kB to ~521 kB raw (~128 kB gzip). See `docs/error-tracking.md`.

Adding a *static* import of one of those barrels — or a second `import()` with a
different specifier for the same file — silently moves the whole graph back into
`__common`; nothing fails at runtime. `client/features/auth/components/__tests__/authComponentsSplitPoint.test.ts`
guards the auth-components invariant; to check a boundary by hand, look for its
sources in the `__common-*.js.map` sourcemap after `bun run build-web`.

## Adjusting the Threshold

Edit the `THRESHOLD` constant at the top of `scripts/check-bundle-size.js`:

```js
const THRESHOLD = 0.10; // 10% — change to 0.05 for 5%, etc.
```

## Common Large Dependencies

Watch for these in `source-map-explorer`:

| Package | Typical Size | Notes |
|---------|-------------|-------|
| `aws-amplify` | ~510KB raw / ~105KB gzip | Lazy in the `cognitoSdk-*` chunk; keep it to one split point (see above) |
| `@rn-primitives/*` | ~5-10KB each | 14 packages installed |
| `zod` | ~475KB raw in the `screen-form-*` chunk | `import * as z from "zod/mini"` is a namespace import, so tree shaking keeps every export: all locales, `toJSONSchema`, and `zod/v4/core`. Lazy (form routes only), but named imports would let the optimizer drop most of it |
| `react-hook-form` | ~43KB | Form state |
