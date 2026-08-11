---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/53
---

# Carousel: interactive dots or honest roles, index re-clamp, leaner scroll wiring

## Goal
Carousel's pagination dots claim tab semantics they can't deliver, the active index survives shrinking children unclamped, and the scroll wiring costs native a per-frame JS callback it doesn't need. Follow-ups from the PR #44 review.

## Context
Verified 2026-08-08 on dev (`packages/ui/src/components/Carousel.tsx`):

- Dots (`:245-253`): non-interactive `View`s carry `accessibilityRole="tablist"` / `"tab"` + `accessibilityState.selected`, with `showsHorizontalScrollIndicator={false}` at `:205`. Screen readers announce N activatable tabs that can't be focused or activated.
- `activeIndex` is seeded once (`:149` clamps only `initialIndex`); nothing re-clamps when `children` shrink, so the status line (`:240`, "X of N") can read "5 of 3" with no active dot until the next scroll.
- Index changes are emitted from both `onScroll` (with `scrollEventThrottle={16}`) and `onMomentumScrollEnd`, deduped by index value only (`:152-159`, `:211-213`): a drag past the midpoint and back fires `onIndexChange(1)` then `(0)` — not "once per settle" as the component docs imply. The 16 ms throttle is also unconditional, so native pays a per-frame JS callback where only web (no momentum-end event for snap points) needs live tracking.
- Slide width is seeded from `useDimensions()` (viewport), not the measured container (`:142-147` region), so a carousel inside a padded parent renders slides too wide on the server / first frame and corrects on `onLayout`. The testimonials template is full-width, so it's unaffected.

## Work
1. Dots: make them `Pressable` and scroll to the tapped index (keep `tab`/`tablist` roles and selected state), or — if press targets at dot size are judged too small — drop the interactive roles and mark the row decorative while keeping the existing live status text as the a11y channel. Prefer pressable.
2. Re-clamp on children change: when `count` shrinks below `activeIndex`, clamp state (and `activeIndexRef`), fire `onIndexChange` with the clamped value, and scroll the ScrollView to the clamped offset.
3. Scroll wiring: emit from `onMomentumScrollEnd` (+ `onScrollEndDrag` fallback) on native and keep the throttled `onScroll` path only on web; align the JSDoc "fires once per settle" claim with actual behavior.
4. Width seeding: document that slides size to the viewport until first layout, or seed from a measured container width when a parent constrains it — a doc caveat on the `Carousel` props is acceptable if measuring adds real complexity.
5. Tests in `packages/ui/src/components/__tests__/Carousel.test.tsx` / `Carousel.web.test.tsx` for 1–3; `packages/ui` version + CHANGELOG per release flow.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual: showcase Carousel on web + one native platform — dots tappable (if option A), removing slides at a high index recovers cleanly, drag-past-midpoint-and-back doesn't double-fire.

## Out of scope
- Autoplay, looping, or gesture libraries (Reanimated stays out).
- Redesigning snap behavior; native paging via `pagingEnabled` stays as-is.

## Open questions
- None.
