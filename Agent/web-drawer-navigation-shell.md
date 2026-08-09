---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Web navigation shell: Drawer rail on desktop, Drawer overlay on mobile web

## Goal
On web, replace tab-style navigation with the library's `Drawer`: a persistent left rail (~248px) on wide viewports and the existing animated overlay + scrim below the breakpoint. Native keeps its tab bar unchanged. Design source (approved): the drawer shell used across all `mockups/0*.html` pages and `mockups/05-mobile.html` frame 5; surface mapping per `05-mobile.html` ("Surfaces" section): native app = tabs, mobile web = Drawer overlay, desktop web = Drawer rail.

## Context
Verified 2026-08-07:

- `Drawer` exists at `packages/ui/src/components/Drawer.tsx` (overlay entrance animates via RN `Animated`; known open issues: swipe-to-close and rail-width gaps). Rail mode is already built: `variant="rail"`, `collapsedWidth` 72 / `expandedWidth` 240, `expandOnHover` (web), controlled `expanded`, `DrawerToggleCollapse`. This spec integrates it, not builds it.
- Tab layout lives at `app/(main)/(tabs)/_layout.tsx`; galleries and demos under `app/(main)/(demos)/`.
- The drawer content per the mockups: wordmark, search affordance, "Library" nav (Overview/Components/Blocks/Templates with counts from the registries), page-contextual section (component categories on the components gallery), footer with theme label + toggle.
- Breakpoint: no 900px token exists. Use `useDimensions()` (`packages/ui/src/hooks/useDimensions.ts`, already SSR-aware via `SsrViewportContext` + `mrmeg-vw` cookie): rail when `isLargeScreen` (> `SCREEN_SIZES.MEDIUM` = 1000, the closest existing token to the 900px mockup), overlay otherwise. Do not add a new constant.
- Reanimated remains banned; any new animation is RN `Animated`.
- SSR constraint: the shell renders server-side — module-scope `createThemedStyles`; `useDimensions` already resolves the SSR viewport (see Breakpoint above), so the rail/overlay choice should not flash on hydration.

## Work
1. Web-only shell layout (platform split at the route-group `_layout` level, e.g. `_layout.web.tsx` alongside the existing tabs layout) rendering `Drawer` as a persistent rail on large screens and overlay+scrim below (breakpoint per Context); native `_layout.tsx` untouched.
2. Drawer content component (`client/features/app/` or `client/showcase/`): nav items with active-route highlighting (accent left edge per mockups), counts from `getComponentCount()`/`getBlockCount()`/`SCREEN_TEMPLATES.length`, theme toggle in the footer.
3. Fix `Drawer` rail-width gaps in `packages/ui` if the rail mode exhibits the known gap issue in this integration; if fixed, minor version bump + CHANGELOG (if not exhibited, note that in the PR).
4. Ensure `theme-color`/`color-scheme` head output matches the active theme so Safari chrome (status bar / toolbar) tints correctly — coordinate with `ssr-theme-cookie.md` rather than duplicating; if that spec has landed, wire into its mechanism.
5. Tests: breakpoint selection logic (unit), shell render smoke web light+dark, active-route highlighting.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual on web: wide window (>1000px) shows the rail with working nav + counts; narrow window shows top bar + hamburger, overlay slides with scrim, tap-scrim dismisses; navigation works from both modes; native app unchanged (tabs). Compare against `mockups/02-components.html` at both widths.
- Mobile Safari: status bar and toolbar tint match the theme.

## Out of scope
- Drawer swipe-to-close gesture (tracked separately in repo memory; not required here).
- ⌘K command palette.
- Native navigation changes.

## Open questions
- None. Breakpoint resolved: `useDimensions().isLargeScreen` (see Context).
