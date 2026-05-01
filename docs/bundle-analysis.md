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
`dist/client/**/*.js`, showing a treemap of every hydrated client module. Use
this to identify large dependencies and dead code without counting the SSR
server renderer.

### `bun run bundle-size`

Compares the total client JS bundle size in `dist/client` against the baseline
in `scripts/bundle-baseline.json`. Exits with code 1 if the bundle grew more
than 10% from the baseline.

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
| `react-native-reanimated` | ~150KB | Required for animations |
| `@rn-primitives/*` | ~5-10KB each | 14 packages installed |
| `zod` | ~13KB | Form validation |
| `react-hook-form` | ~9KB | Form state |
