---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Wire SSR viewport metrics so first paint isn't laid out at width 0

## Goal
SSR currently lays the tree out at viewport width 0, shipping broken geometry in the HTML: negative header `max-width`s, dozens of `width:0px`/`height:0px`, content hugging the left edge (user saw "centered" onboarding content sitting off to the left), and a React #418 hydration mismatch on first load. Wire the repo's existing-but-unused SSR viewport machinery so the server lays out at a real width and the first paint matches the hydrated tree.

## Context
Verified 2026-08-06:

- react-native-web's server-side `Dimensions.window` is `{width: 0, height: 0}` (`update()` early-returns without DOM), and `SafeAreaProvider` falls back to `Dimensions.get('window').width` when no `initialMetrics` prop is passed. `client/features/app/RootLayout.tsx:130` renders `<SafeAreaProvider>` with no `initialMetrics`; react-native-safe-area-context's web provider only measures in a mount effect ("Skip for SSR").
- Consequence in production SSR HTML for `/showcase`: header title container ships `style="max-width:-68px"` (from `layout.width - 68` with `layout.width === 0` in expo-router's Header), one more negative max-width, 22× `width:0px`, 4× `height:0px`. Browser probe confirms React error #418 (hydration mismatch) fires on first load only.
- The fix machinery already exists and **nothing uses it**: `server/lib/ssrViewport.ts` (`withSsrViewport(loader)` — `mrmeg-vw` cookie, UA fallback, desktop default 1280) and `client/components/SsrViewportProvider.tsx` (reads it via `useLoaderData`). `grep -rn "withSsrViewport\|SsrViewportProvider" app/ client/ server/` matches only the two modules themselves.
- **Constraint (documented in `server/lib/ssrOnboarding.ts:16`):** layouts cannot export loaders. `RootLayout` therefore can't get the viewport via its own loader; the loader must live on routes (or the value must reach the root layout another way, e.g. the same request-scoped channel `ssrOnboarding` uses).

## Work
1. Deliver the SSR viewport to `RootLayout` and pass it to `SafeAreaProvider`:
   `initialMetrics={{ frame: { x: 0, y: 0, width: ssrWidth, height: ssrHeight }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}` at `client/features/app/RootLayout.tsx:130` (web SSR only — native keeps `initialWindowMetrics` behavior it has today; guard so native and client-only web renders are unchanged).
2. Wire `withSsrViewport` + `SsrViewportProvider` for the SSR-visible route surface. Given the layouts-can't-load constraint, follow how `ssrOnboarding` gets request data to the root gate; if that channel doesn't generalize, add `export const loader = withSsrViewport(...)` per route group covering at minimum onboarding and the `(main)` routes, and record the coverage decision in the PR.
3. Confirm expo-router's Header no longer computes negative `max-width` server-side once `SafeAreaProvider` has a real frame; if Header reads its width from a different source (`useWindowDimensions` → RNW `Dimensions`), extend the same seeding to that source (RNW `Dimensions.set()` is per-process — same per-request leak caution as the theme store: must not bleed across concurrent requests).
4. Tests: extend the SSR render test to assert the rendered HTML for a cookie/UA-derived width contains no `max-width:-` and no `width:0px` on the header subtree; unit-test the metrics plumbing (provider present → SafeAreaProvider receives frame width).

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`
- Manual, production-mode server: `curl` `/showcase` (and the onboarding route) and grep the HTML — zero `max-width:-`, header/centered containers carry real widths.
- Browser: cold load in a normal desktop window — onboarding content visually centered from the first frame (no left-hugging), no React #418 in the console, no layout jump at hydration.

## Out of scope
- Theme flash (`ssr-theme-cookie.md`).
- Flush cascade order (`ssr-flush-cascade-order.md`).
- Dev-server SSR shipping no app content (separate known issue; validate on production mode).

## Open questions
- None blocking; route coverage breadth (all SSR routes vs. onboarding + `(main)`) is the implementer's call, recorded in the PR.
