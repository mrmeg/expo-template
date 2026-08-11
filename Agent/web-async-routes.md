---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Enable async routes on web to split route code out of the entry bundle

## Goal
Stop bundling every route into the web entry. Today the entry chunk (3.82 MB uncompressed / 726 kB gzip) statically contains all of `app/(main)` (292 kB), `client/templates` (137 kB), `client/showcase` (40 kB), `client/features` (137 kB), plus route-only dependencies: zod (363 kB, imported only by `client/templates/form/demo.tsx`), react-hook-form + resolvers (~42 kB), vaul (30 kB), and most of the Radix select/menu cluster. Expected entry reduction: roughly 1 MB uncompressed.

## Context
Verified against the exported bundle's module graph (2026-08-11):

- The router require-context module (`/app?ctx=…`) lists every route as a static dependency — no per-route split points exist. The `index-*.js` files in `dist` are per-page server artifacts, not lazy route chunks; route JS is duplicated into entry.
- `app.config.ts` `basePlugins()` (~line 63) configures the `expo-router` plugin with `origin`, `unstable_useServerMiddleware: true`, `unstable_useServerDataLoaders: true`. No `asyncRoutes` key.
- SDK 57's expo-router plugin supports `asyncRoutes` (`node_modules/expo-router/plugin/options.json`): value `"production"` is web-only and auto-disabled on native.
- `web.output` is `"server"`; each route gets a build-time prerendered HTML shell, and the exported HTML is the onboarding gate. Data loaders snapshot at export.
- Bundle budget lives in `scripts/check-bundle-size.js` + `scripts/bundle-baseline.json` (sums all client JS, so total across chunks should stay roughly flat while entry shrinks — the metric is total JS; splitting may slightly increase total due to chunk overhead but removes the duplication noted above).

## Work
1. In `app.config.ts`, add to the `expo-router` plugin options:
   `asyncRoutes: { web: "production", default: false }` (or the schema-preferred equivalent — keep dev and native behavior unchanged).
2. Export and inspect: entry must no longer contain `/app/(main)/(demos)/`, `client/templates/`, `node_modules/zod/`, or `react-hook-form`. Use:
   `bun run build-web && bun x source-map-explorer 'dist/client/_expo/static/js/web/entry-*.js' 'dist/client/_expo/static/js/web/entry-*.js.map' --no-border-checks --json /tmp/sme.json` and grep the file list.
3. Rebaseline: `node scripts/check-bundle-size.js --update`, commit `scripts/bundle-baseline.json`.
4. If prerender/hydration breaks (see Validation), stop and mark the spec blocked with findings rather than working around it.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`.
- `bun run build` succeeds (prerender runs at export; any route that fails to prerender under lazy loading will fail here).
- Entry composition check from Work step 2.
- Serve the export (`bun run start` against `dist`) and verify in a browser (ui-verifier):
  - Home `(tabs)/index` renders and hydrates without console errors.
  - Navigate to a demo route (e.g. `/components`, form demo) — the route chunk loads on navigation and renders.
  - A data-loader-backed route still shows its export-time snapshot data (loaders + async routes interaction is the main risk).
  - Prerendered HTML shells for routes still contain the SSR style snapshot (no unstyled flash — `+html.tsx` snapshot filter must still apply per route).
- `node scripts/check-bundle-size.js` passes with the new baseline.

## Out of scope
- Native async routes (stays disabled).
- Keyboard-controller/Reanimated web split and Clerk provider lazy chunk (separate specs).
- Restructuring routes, templates, or the showcase.

## Merge plan
Three bundle-size specs each rewrite `scripts/bundle-baseline.json`. Whichever lands later must rebuild and regenerate the baseline after rebasing on dev.

## Open questions
- None blocking. If `asyncRoutes` proves incompatible with `unstable_useServerDataLoaders` or the server-output prerender, block the spec and report — do not ship a partial config.
