---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# client/: move raw font sizes and line heights onto the StyledText scale

## Goal

`bun lint:ui` (app, client, shared) reports zero `expo-ui/no-raw-typography`
findings, so the template's own screens follow the rule the plugin now teaches
consumers, and a fork inherits text on the scale.

## Context

- #122 added `no-raw-typography` and fixed `app/` (18 findings); `client/`
  was left with 29 because `bun run lint` does not gate it. The findings are
  `fontSize` / `lineHeight` literals in `createThemedStyles` sheets whose
  styles land on `StyledText` aliases (`SansSerifText`, `SansSerifBoldText`);
  the hook result hides them from `no-restyle`.
- Files: `client/showcase/ShowcaseScreen.tsx` (18),
  `client/showcase/BlocksGalleryScreen.tsx` (5),
  `client/features/auth/components/authFormStyles.ts` (4),
  `client/showcase/ComponentsGalleryScreen.tsx` (2).
- Scale: `xs` 11/16.5, `sm` 12/18, `base` 14/21, `body` 15/24.75, `lg` 18/27,
  `xl` 22/26.4, `xxl` 28/33.6, `display` 34/40.8.

## Work

1. For each finding, drop `fontSize` / `lineHeight` from the sheet and put the
   nearest `size` on the `StyledText` usages of that style; keep color and
   spacing in the sheet, move a raw `fontWeight` to the prop.
2. Snap: 13 → `base`, 10 and 11 → `xs`, 12 → `sm`, 14 → `base`, 16 → `body`,
   18 → `lg`, 20 → `xl`; line heights follow the size.
3. `bun lint:ui` clean; screens unchanged in structure.

## Validation

- `bun lint:ui`, `bun run typecheck`, `bun run lint`, `bun run test:ci -- client`,
  `bun run verify`.
- Web `/showcase`, `/blocks`, `/components`, `/auth-demo` light before/after under
  `/tmp/fleet/ui/expo-ui/client-typography/`.

## Out of scope

`letterSpacing` literals; the lint rule itself.

## Open questions

None.
