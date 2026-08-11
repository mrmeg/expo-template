---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/55
---

# Showcase galleries: progressive preview mounting on client transitions

## Goal

Client-side navigations into `/components` blank the content pane for seconds
while all 36 live previews mount in one synchronous burst. Bound that work —
mount card chrome immediately and stream the live previews in small per-frame
batches — without giving up the SSR-complete gallery HTML on direct loads.

## Context

Verified 2026-08-09 on the production SSR build (PR #49's verification run):

- Client transition to `/components` → first `component-card-`: rail item
  0.6–15s (variable), the PRE-EXISTING in-page Explore link >12s in 5 of 6
  trials (one hang >25s); direct URL loads ~500ms consistently. During a hang:
  zero pending network, zero console errors — it is pure client render cost of
  mounting 36 live previews (most of `@mrmeg/expo-ui`) at once. Machine was
  under load; relative numbers are the signal.
- `app/(main)/(demos)/components/index.tsx` → `ComponentCard` calls
  `renderPreview(entry.id)` (factory in `client/showcase/previews.tsx`)
  unconditionally inside the card's `cardPreview` wrapper. Cards render in
  category sections, so any mount budget must be a single running index across
  sections, not per-section. `/blocks/index.tsx` mounts 6 live stages via
  `renderBlockStage` (`client/showcase/blockStages.tsx`) the same way.
- **"Virtualized list" in the scroll-window sense is precedent-blocked**:
  PR #30 (LegendList for templates) was declined — items gate behind an
  onLayout-only `canRender` flag that never fires server-side, so web SSR
  ships zero rows. FlashList is ruled out for the same measurement-driven
  reason. RNW `FlatList` DOES SSR its `initialNumToRender` window (why
  templates stayed on it), but adopting it here would drop every below-fold
  card from the SSR HTML the galleries deliberately ship complete, and the
  category-section grid doesn't map onto one list without restructuring.
  So: virtualize the MOUNT SCHEDULE, not the scroll window.
- Hydration constraint (React #418 history): the server renders every preview,
  so the client's FIRST render of server HTML must too. The safe discriminator
  is "has React already committed once this app load": effects run after the
  hydration commit, so a flag set in a `RootLayout` mount effect is `false`
  during SSR and during the hydration render (both render full previews —
  identical trees), and `true` for every screen mounted by a later client-side
  navigation (no server HTML to match — free to defer). Native never hydrates;
  post-first-commit transitions there defer too, which is a win on-device.
- `Skeleton` exists in `packages/ui/src/components/Skeleton.tsx` for the
  placeholder; `jest` suites never set the flag, so
  `client/showcase/__tests__/galleries.test.tsx` ("one card per registered
  component") keeps exercising the full-mount path unmodified.
- Reanimated stays banned; batching is plain `requestAnimationFrame` chaining
  (portable to native, unlike `requestIdleCallback`).

## Work

1. `client/lib/hydration.ts` (new): module-scope flag with `markHydrated()` +
   `hasHydratedOnce()`. Call `markHydrated()` from a mount effect in
   `client/features/app/RootLayout.tsx` (the existing first-commit effect
   block is fine).
2. `client/showcase/useProgressivePreviewCount.ts` (new): given `total`,
   returns how many previews may render live. If `hasHydratedOnce()` was false
   at mount (SSR / hydration render), return `total` from the first render and
   never animate. Otherwise start at an initial burst (enough to cover the
   fold — start ~8 for components, ~2 for blocks; tune while implementing) and
   grow by a small batch per `requestAnimationFrame` until `total`. Cancel on
   unmount. The initial value must come from a `useState` initializer so the
   choice is render-stable.
3. `components/index.tsx`: thread a running card index across the category
   sections; a card whose index is past the allowance renders `Skeleton` in
   `cardPreview` (testID `component-card-skeleton-${id}`) instead of
   `renderPreview`. Card chrome (name, category, link) always renders.
4. `blocks/index.tsx`: same hook over the 6 stages.
5. Tests:
   - Hook unit: full-immediate pre-hydration; post-hydration grows from burst
     to total under faked rAF; unmount cancels.
   - Gallery post-hydration path: `markHydrated()` then render → skeletons
     present first, all previews after flushing frames; pre-hydration path
     still mounts everything immediately (existing galleries suite must pass
     unmodified — that IS the assertion).
6. Reset the flag between jest tests if it leaks (module state +
   `clearMocks` don't reset module scope — expose a test-only reset or reset
   in `test/setup.ts`).

## Validation

- `bun run verify` and `bun run ui:test`.
- Browser, production build (`bun run build` → `PORT=… bun ./server.bun.ts`):
  - Direct load of `/components` (with `has-seen-onboarding=1`): HTML still
    contains all 36 `component-card-` testIDs with live preview markup and
    ZERO `component-card-skeleton-` testIDs; no hydration/console errors.
  - Client transition (Explore in-page link AND drawer rail item) at 1440px:
    card chrome paints promptly (<~1s to first `component-card-`), previews
    fill within a few seconds, pane is never blank; re-measure with PR #49's
    timing approach and compare against the numbers above.
  - `/blocks` spot-check both paths.

## Out of scope

- Scroll-window virtualization (FlatList/LegendList/FlashList — see Context).
- The kitchen-sink `/showcase` route and Explore's 6-preview rail.
- `content-visibility` experiments and preview code-splitting (`React.lazy`) —
  the bundle is already loaded during a hang; downloads are not the cost.
- Component detail (`/components/[id]`) — it mounts one component's variants.

## Open questions

- None. Batch sizes are implementation-tunable; everything else is resolved
  above.
