---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/54
---

# Avatar: render non-uri image sources; fix AvatarGroup a11y and max clamp

## Goal
`Avatar` silently never renders valid image sources that aren't uri-shaped, and `AvatarGroup`'s accessibility container hides its members from screen readers. Fix both, plus two small hardening items from the PR #46 review.

## Context
Verified 2026-08-08 on dev (`packages/ui/src/components/Avatar.tsx`):

- `getSourceKey` (`:89-97`) exists to key error/retry state by content (a fresh `{uri}` object identity per render would reset the failure flag and loop image → error → image). But it returns `null` for any object source without a truthy `uri` — e.g. iOS `{bundle, name}` or a resolved-asset object — and `null` means "no usable image", so `showImage` stays false and the image is never attempted: silent degradation to initials for a valid source. (`typeof source === "number"` require() assets are handled at `:91`.)
- `AvatarGroup` container (`:317-325` region) sets `accessible` + `accessibilityRole="image"` + a "N avatars" label while child Avatars keep their own labels. `role="img"` is a leaf role on web and an `accessible` container swallows descendants on iOS — per-member names become unannounceable inside a group.
- `max` guard (`:307`): `max != null && max >= 0` means a negative `max` renders every child instead of clamping to zero; a fractional `max` truncates via `slice`.
- Image rounding relies solely on the wrapper's `overflow: "hidden"` + radius (no `borderRadius` on the `Image` itself) — the long-standing Android clipping case; and while an image loads, the tile shows only the `muted` background instead of the initials fallback.

## Work
1. `getSourceKey`: produce a stable key for every non-null source shape — keep `asset:<n>` for numbers and uri strings where present; fall back to a stable serialization (e.g. `JSON.stringify` of the object) instead of `null`, so any provided source is attempted. Reserve `null` strictly for "no source".
2. AvatarGroup a11y: drop the swallowing container semantics — remove `accessible`/`role="image"` from the wrapper (keep the count label as a hidden summary or on the overflow tile) so member Avatars announce individually; or aggregate names into the group label. Pick one, document it, and cover with a test.
3. Clamp `max`: `Math.max(0, Math.floor(max))`; `max={0}` renders only the `+N` tile, negative behaves as 0.
4. Android rounding: set the radius on the inner `Image` as well as the wrapper.
5. Loading state: show the initials/icon fallback until `onLoad`, not a bare `muted` tile.
6. Tests for each in `packages/ui/src/components/__tests__/Avatar.test.tsx`; `packages/ui` version + CHANGELOG per release flow.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual: showcase Avatar section on web + one native platform — object-shaped source renders; group members readable with a screen reader (or web accessibility tree inspection); slow-network image shows initials first.

## Out of scope
- Switching to `expo-image` (package has no image dep by design).
- Presence dots / status badges.

## Open questions
- None.
