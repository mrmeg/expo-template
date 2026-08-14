---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/64
---

# Web SSR experiment: reinstate per-request rendering for comparison

## Goal
Re-enable per-request web SSR on an experimental branch so it can be compared against the current client-rendered setup. Bugs previously attributed to SSR turned out to be unrelated (the chronic blank screen was a desktop-Chrome profile issue; the KeyboardGestureArea crash was a nested duplicate dependency), so the original removal rationale is weaker than it looked. The PR stays a draft comparison artifact — merging is a separate decision.

## Context
- SSR was removed in `2cfc61d` (PR #56, merged 2026-08-11). That commit is the map of everything that existed: the `expo-router` plugin's `unstable_useServerRendering` flag, `SsrThemeProvider`/`SsrViewportProvider`, `client/features/app/SsrStyleFlush.tsx` plus its `app/+html.tsx` anchor, `client/features/app/blankRecoveryScript.ts`, `server/lib/ssrTheme.ts`/`ssrViewport.ts`/`ssrOnboarding.ts`, the `server.bun.ts` warm-up gate, a metro dedupe guard, and the `packages/ui` support surface (`SsrThemeSeedContext`, `SsrViewportContext`, `THEME_COOKIE_NAME`, removed in expo-ui 0.21.0).
- A plain `git revert 2cfc61d` will not apply. Web has since changed underneath it:
  - `asyncRoutes: { web: "production" }` is now on in `app.config.ts` (~line 80, commit `39b7bf3`). SSR was never run with async routes in this repo; compatibility is unverified.
  - CSS-variable theming landed on web (`37cde2f`, PR #63): exported shells are theme-agnostic and the theme shield is gone. This plausibly makes the whole theme-cookie/`SsrThemeSeed` half of the old machinery unnecessary — CSS variables can resolve the theme at first paint without the server knowing it.
  - The Feather font is registered during export-time render (`2068466`), keyboard-controller is platform-split (`74b11bc`), and the Clerk provider ships in a lazy chunk (`eac3f78`).
- `packages/ui` is the workspace source for `@mrmeg/expo-ui`, so any restored SSR surface (viewport seeding at minimum) can live branch-local without publishing.
- Known SSR landmines from the previous era, still true if reinstated:
  - Dev-server node env externalizes `react`/`react-dom`/`@radix-ui`; the metro dedupe rewrite must skip those there or Radix crashes with null `useContext`. The skip guard was deleted with SSR — the dedupe in `metro.config.js` (~line 59) is now unconditional and must get the guard back.
  - Server-rendered styles must be registered at module scope (`createThemedStyles`) to land in the head snapshot; render-time `createStyles(theme)` misses it.
  - Under per-request SSR, data loaders run per request again — the Server Alpha param'd-route workaround (API fetch around the export-time snapshot, in `client/features/server-alpha/`) may be revertible.

## Work
1. Branch `agent/web-ssr-experiment` from `dev`.
2. In `app.config.ts`, set `unstable_useServerRendering: true`. First try it with `asyncRoutes: { web: "production" }` kept on; if export or per-request render breaks, drop async routes on this branch and record that as a finding.
3. Reinstate the minimum machinery for a correct server render, using `2cfc61d` as reference but re-derived against current `RootLayout.tsx`, `onboardingStore.ts`, and `useDimensions.ts`:
   - Viewport seeding: `server/lib/ssrViewport.ts` + a `SsrViewportContext` channel in `packages/ui` (or an equivalent) so `useDimensions` sees a real viewport server-side.
   - Style snapshot: `SsrStyleFlush` + the `+html.tsx` anchor and snapshot filter.
   - Theme seeding: attempt WITHOUT restoring the cookie/`SsrThemeSeed` path first — CSS-variable theming may already give a correct themed first paint. Only restore it if dark-mode first paint is provably wrong without it.
   - Skip the warm-up gate and blank-screen recovery script unless the experiment reproduces the failures they guarded.
4. Restore per-request loader behavior where it simplifies things (Server Alpha param'd route), or leave as-is if noisy.
5. Open a draft PR against `dev` whose description is the comparison report: SSR HTML content vs current exported shells (SEO-visible content), first-paint theming, hydration warnings, TTFB/FCP impressions from `bun run build && bun run start`, and any async-routes finding.

## Validation
- `bun run typecheck`, `bun run test:ci`, `bun run lint` pass.
- `bun run build && bun run start`: `curl` of `/` and a content route returns HTML containing real route content, not an empty shell; browser load shows no hydration-mismatch warnings; dark-mode first paint is dark; onboarding gate still works.
- The draft PR description contains the written comparison.

## Out of scope
- Merging the PR or deciding adoption — that is the comparison's output, decided by the user.
- Publishing an expo-ui release with a restored SSR surface (branch-local workspace changes only).
- Native behavior changes.
