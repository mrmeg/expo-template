---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Theming knobs: shape overrides for more components, typed extra color tokens

## Goal

Let an app set radii for inputs, cards, sheets, badges and dialogs the way it
already can for Button, and extend `ThemeColors` with its own typed tokens so it
stops keeping a side palette. Additive, backward compatible.

## Context

- `state/themeStore.ts:49-64` `ShapeOverrides = { button?: { borderRadius?, withShadow? } }`;
  Button reads it at `Button.tsx:231,380`. README "Shape overrides" documents it.
- Radii today: TextInput/InputOTP/Select/Popover/Tooltip/Item/Accordion `radiusMd`;
  Card/Dialog/EmptyState/Notification `radiusLg`; Badge `radiusFull`;
  BottomSheet 16 (`spacing.xl / 2`, changed to `radiusXl` by the visual-audit
  spec if it lands first — either value is the base to override).
- Colors: `ThemeColors` interface in `constants/colors.ts:56-100`;
  `ColorOverrides = { light?: Partial<ThemeColors>; dark?: Partial<ThemeColors> }`;
  `useTheme` merges package default → `setColors` → `ThemeColorScope` and returns
  the base by reference when no override exists. Web base tokens are `var(--c-*)`
  (`getThemeCssVariables` emits only `themeColorTokens`); override values pass
  through as literals (`resolveRawColor`).

## Work

1. `ShapeOverrides` gains `input`, `card`, `sheet`, `badge`, `dialog`, each
   `{ borderRadius?: number }` (Button keeps `withShadow`). Add
   `hooks/useShape.ts`: `useShape("card")` returns the override or `undefined`.
   Apply, layered right after the static radius like Button does:
   `input` → TextInput (not the `underlined` variant), Select trigger, InputOTP
   cells; `card` → Card, StatCard, EmptyState container, SkeletonCard;
   `sheet` → BottomSheet; `badge` → Badge; `dialog` → Dialog and Alert dialog
   content. A caller `style` still wins.
2. `export interface ThemeColorExtensions {}` in `constants/colors.ts`;
   `ThemeColors extends ThemeColorExtensions`. Document module augmentation:
   ```ts
   declare module "@mrmeg/expo-ui/constants" { interface ThemeColorExtensions { brandGold: string } }
   ```
   `setColors`/`ThemeColorScope` accept the extra keys (they already type
   through `Partial<ThemeColors>`); `useTheme().theme.colors.brandGold` is typed.
   `getThemeCssVariables(overrides)` also emits `--c-<kebab>` for extension keys
   present in the overrides so `+html.tsx` shells can use them; runtime values
   stay literals per scheme (state that in the README, plus the identity caveat:
   with any override `theme.colors` changes per scheme).
3. Tests first: `useShape` returns per-component overrides and `undefined` when
   unset; each component above applies `borderRadius` from `setShape` and
   `setShape({})` restores the default; a type test file under
   `packages/ui/src/__tests__/` augmenting `ThemeColorExtensions` and asserting
   (`// @ts-expect-error` on a missing key) plus a runtime merge test through
   `setColors` and `ThemeColorScope`; `getThemeCssVariables` emits the extra var.
4. Docs: README "Shape overrides" (table of slots and the components each
   reaches) and new "Extending the palette" subsection; `LLM_USAGE.md`;
   `themeStore.ts` JSDoc; CHANGELOG Added. `bun run docs:llms`. The lint
   package's `design-system.json` manifest does not change.

## Validation

- `bun run ui:test`, `bun run ui:typecheck`, `bun run typecheck`, `bun run lint`,
  `bun run docs:llms:check`, `bun run verify`.
- Web: `client/showcase/ThemedShowcaseScreen.tsx` gets a "Shape" control
  (`setShape` presets: default / rounded / square) so the change is visible;
  before/after under `/tmp/fleet/ui/expo-ui/theming-knobs/`.

## Out of scope

Per-component spacing or shadow overrides beyond Button; a radius scale override.

## Open questions

None.
