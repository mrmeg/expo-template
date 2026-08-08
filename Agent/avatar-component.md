---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/46
---

# Avatar + AvatarGroup component in @mrmeg/expo-ui

## Goal
The library has `SkeletonAvatar` (a loading placeholder, `packages/ui/src/components/Skeleton.tsx:131-142`) but no actual Avatar. Profile/testimonials templates and the upcoming blocks tier (testimonial strip, activity items) need one. Add `Avatar` (image with initials/icon fallback) and `AvatarGroup` (overlapping stack with `+N` overflow).

## Context
Verified 2026-08-07:

- `packages/ui/src/components/` has no `Avatar.tsx`; consumers hand-roll circles (e.g. profile template).
- Component conventions in this package: one file per component, exported from `packages/ui/src/components/index.ts`, imported by consumers as `@mrmeg/expo-ui/components/<Name>`; themed via `useTheme` + `createThemedStyles`; sizes/radii from `packages/ui/src/constants/spacing.ts` (radiusFull 9999; icon sizes 12/16/24/32/48).
- Images: `packages/ui` has no `expo-image` dependency and currently renders no images anywhere — use RN `Image` (no new peer dep; the package publishes to npm: minor bump + CHANGELOG).
- The showcase registry (`client/showcase/registry.ts:77-111`) will need an entry; category `layout` fits existing groupings.

## Work
1. `packages/ui/src/components/Avatar.tsx`:
   - `Avatar`: `source?` (image), `name?` (derives 1–2 initials for fallback), `icon?` (Feather fallback when no name), `size?` (`"sm" | "md" | "lg" | number`, default md), `shape?` (`"circle" | "square"`, default circle). Fallback background derives from theme `muted`/`accent` tokens; image load failure falls back to initials.
   - `AvatarGroup`: children Avatars overlapped with a themed ring (border in `background` color so it reads on any surface), `max?` prop rendering a `+N` overflow avatar.
   - Accessibility: `accessibilityLabel` from `name` by default; group announces count.
2. Export from `packages/ui/src/components/index.ts`; add to `COMPONENTS` in `client/showcase/registry.ts` (category `layout`).
3. Showcase section in `app/(main)/(demos)/showcase/index.tsx` (sizes, fallbacks, group with overflow).
4. Tests in `packages/ui/src/components/__tests__/`: initials derivation (single/multi word, unicode), fallback order (image → initials → icon), group max/overflow count.
5. `packages/ui` minor version bump + CHANGELOG entry per the release flow.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual: showcase screen on web + one native platform, light and dark; image fallback by pointing `source` at a broken URL.

## Out of scope
- Presence dots / status badges (compose `Badge` externally if needed).
- Replacing hand-rolled circles in existing templates (follow-up).

## Open questions
- None. Image primitive resolved: RN `Image` (see Context).
