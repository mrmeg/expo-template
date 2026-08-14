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

The current checked-in baseline is 5,167,000 bytes of client JS from the latest
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
| `client/features/auth/components` | `AuthGate`, `(demos)/auth-demo`, `(demos)/showcase` | auth screen + 5 forms (~58 kB raw, ~16 kB gzip) |

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
| `zod` | ~13KB | Form validation |
| `react-hook-form` | ~9KB | Form state |
