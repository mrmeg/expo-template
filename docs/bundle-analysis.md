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

The current checked-in baseline is 5,122,572 bytes of client JS from the latest
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

## Adjusting the Threshold

Edit the `THRESHOLD` constant at the top of `scripts/check-bundle-size.js`:

```js
const THRESHOLD = 0.10; // 10% — change to 0.05 for 5%, etc.
```

## Common Large Dependencies

Watch for these in `source-map-explorer`:

| Package | Typical Size | Notes |
|---------|-------------|-------|
| `aws-amplify` | ~200KB+ | Auth only? Consider `@aws-amplify/auth` alone |
| `@rn-primitives/*` | ~5-10KB each | 14 packages installed |
| `zod` | ~13KB | Form validation |
| `react-hook-form` | ~9KB | Form state |
