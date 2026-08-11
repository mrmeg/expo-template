---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/62
---

# Enable async routes on web to split route code out of the entry bundle

## Goal
Stop bundling every route into the web entry. Today the entry chunk statically contains all of `app/(main)` (292 kB), `client/templates` (137 kB), `client/showcase` (40 kB), `client/features` (137 kB), plus route-only dependencies: zod (363 kB, imported only by `client/templates/form/demo.tsx`), react-hook-form + resolvers (~42 kB), vaul (30 kB), and most of the Radix select/menu cluster.

Measured outcome (verified 2026-08-11 in a worktree export with this exact change): entry 3,915,289 → 1,083,455 bytes (961 → 283 kB gzip). True initial payload per route shrinks less because a shared `__common` chunk (1.86 MB raw / 456 kB gzip) is referenced eagerly by every route HTML: root route total scripts go 4.08 MB → 3.01 MB raw (1,000 → 759 kB gzip), i.e. −26% raw / −24% gzip. Demos, zod, and react-hook-form go fully lazy; ~18 template sources, ~10 showcase sources, and vaul remain eager inside `__common` (they're shared by the home route's showcase previews and multiple route chunks). Slimming `__common` is a follow-up, not this spec.

## Context
Verified against the exported bundle's module graph (2026-08-11):

- The router require-context module (`/app?ctx=…`) lists every route as a static dependency — no per-route split points exist. The `index-*.js` files in `dist` are per-page server artifacts, not lazy route chunks; route JS is duplicated into entry.
- `app.config.ts` `basePlugins()` (~line 63) configures the `expo-router` plugin with `origin`, `unstable_useServerMiddleware: true`, `unstable_useServerDataLoaders: true`. No `asyncRoutes` key.
- SDK 57's expo-router plugin supports `asyncRoutes` (`node_modules/expo-router/plugin/options.json`): either a bare `"development" | "production" | boolean` or a per-platform object `{ web, ios, android, default }`. `"production"` is web-only and auto-disabled on native.
- The repo `.env` already sets `EXPO_UNSTABLE_TREE_SHAKING=1` and `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` — all baseline numbers above already include tree shaking.
- `web.output` is `"server"`; each route gets a build-time prerendered HTML shell, and the exported HTML is the onboarding gate. Data loaders snapshot at export.
- Bundle budget lives in `scripts/check-bundle-size.js` + `scripts/bundle-baseline.json` (sums all client JS, so total across chunks should stay roughly flat while entry shrinks — the metric is total JS; splitting may slightly increase total due to chunk overhead but removes the duplication noted above).

## Work
1. In `app.config.ts`, add to the `expo-router` plugin options:
   `asyncRoutes: { web: "production" }` (omitting other platforms keeps dev and native behavior unchanged).
2. Export and inspect: entry map must no longer contain `/app/(main)/(demos)/`, `client/templates/`, `node_modules/zod/`, or `react-hook-form` (all verified 0 in the test export; expect ~53 JS files with per-route chunks like `screen-form-*`, `auth-demo-*`, plus a `__common-*` chunk).
3. Rebaseline: `node scripts/check-bundle-size.js --update`, commit `scripts/bundle-baseline.json`. Note the budget metric sums ALL client JS — total may tick up slightly from chunk overhead even though initial payload drops; that's expected.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`.
- `bun run build` succeeds. Already verified once in a worktree: all 36 routes prerender, 11 API routes + middleware build, `routes.json` byte-identical, root prerendered markup identical, loader snapshot (`client/_expo/loaders/(main)/(demos)/server-alpha/index`) differs only in embedded timestamps. Re-confirm the same holds on the final diff.
- Entry composition check from Work step 2.
- Runtime (the one thing the worktree test could NOT cover): serve the export (`bun run start` against `dist`) and verify in a browser (ui-verifier):
  - Home `(tabs)/index` renders and hydrates without console errors.
  - Navigate to a demo route (e.g. `/components`, form demo) — the route chunk loads on navigation and renders.
  - The `server-alpha` loader-backed route still shows its export-time snapshot data.
  - No unstyled flash on a route load (the `+html.tsx` SSR style snapshot must still apply per route).
- `node scripts/check-bundle-size.js` passes with the new baseline.

## Out of scope
- Native async routes (stays disabled).
- Keyboard-controller/Reanimated web split and Clerk provider lazy chunk (separate specs).
- Restructuring routes, templates, or the showcase.
- Slimming the eager `__common` chunk (template/showcase/vaul residue shared with the home route) — follow-up spec candidate.

## Merge plan
Three bundle-size specs each rewrite `scripts/bundle-baseline.json`. Whichever lands later must rebuild and regenerate the baseline after rebasing on dev.

## Open questions
- None. Export/prerender/loader compatibility was verified empirically (2026-08-11 worktree export); only browser hydration remains, covered in Validation.
