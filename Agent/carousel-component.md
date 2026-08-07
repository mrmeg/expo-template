---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Carousel component in @mrmeg/expo-ui

## Goal
The testimonials template hand-rolls snap-scrolling quote cards; the blocks tier (testimonial strip) and future media blocks need the same behavior. Promote it to a reusable `Carousel` with snap paging, dot indicators, and optional peek of the next item.

## Context
Verified 2026-08-07:

- No `Carousel.tsx` in `packages/ui/src/components/`; `client/templates/testimonials/Screen.tsx:75-88` implements it inline: horizontal `ScrollView` with `snapToInterval={cardWidth + spacing.md}`, `decelerationRate="fast"`, `snapToAlignment="start"`, `cardWidth = 0.8 × window width` — the reference behavior for the extracted component.
- Hard constraint: **Reanimated is banned in this repo** (drawer/bottom-sheet animation work was done with RN `Animated` for this reason). The carousel must use `ScrollView`/`FlatList` snap props (`pagingEnabled`/`snapToInterval`, `onMomentumScrollEnd`) and RN `Animated` at most — no new animation deps.
- SSR constraint: measurement-driven lists render no rows server-side (why LegendList was declined; FlatList stays). Prefer a `ScrollView`-based implementation so items are in the SSR tree, and register styles at module scope via `createThemedStyles` (`docs/ssr-hydration.md`).
- Component conventions: one file per component, exported from `packages/ui/src/components/index.ts`, themed via `useTheme`, registered in `client/showcase/registry.ts:77-111`.

## Work
1. `packages/ui/src/components/Carousel.tsx`:
   - Children-based API (`<Carousel><Card/>…</Carousel>`), props: `itemWidth?` (number | fraction of container, default ~0.85 for peek), `gap?`, `showDots?` (default true), `initialIndex?`, `onIndexChange?`, `snap?` (default true).
   - Horizontal `ScrollView` with snap interval derived from item width + gap; active index tracked via scroll offset; dots are plain themed views (active = `accent`).
   - Web: same ScrollView path (RNW maps to CSS overflow + scroll-snap where possible); ensure wheel/trackpad scrolling works and dots update.
   - Accessibility: `accessibilityRole` on dots, page announcement ("2 of 5").
2. Export from `packages/ui/src/components/index.ts`; add to `COMPONENTS` in `client/showcase/registry.ts` (category `layout`).
3. Refactor `client/templates/testimonials/Screen.tsx` to consume `Carousel` (this is the proof the API fits; visual behavior must not regress).
4. Showcase section in `app/(main)/(demos)/showcase/index.tsx`.
5. Tests: index math from scroll offsets (unit), render smoke with N children, `onIndexChange` firing on simulated momentum end.
6. `packages/ui` minor version bump + CHANGELOG entry per the release flow.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual: testimonials template on web + one native platform — snap feel, dots, peek; SSR view-source of the testimonials route still contains the quote content.

## Out of scope
- Autoplay, looping/infinite mode, vertical orientation (add later behind props if needed).
- Media-gallery template (separate future spec).

## Open questions
- None blocking.
