---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/121
---

# Component visual audit fixes

## Goal

Fix the inconsistencies found in the 390×844 light/dark web audit of the
showcase (`/tmp/fleet/ui/expo-ui/before/`): unreadable loading and control
states, missing focus rings, off-scale radii, web accessibility props that
leak to the DOM, and docs that disagree with the code.

## Context

- Skeleton (`components/Skeleton.tsx:84`) fills with `theme.colors.muted`
  (light `#F4F4F5` on white cards) and pulses to 0.3 opacity: invisible in light,
  faint in dark.
- SegmentedControl (`components/SegmentedControl.tsx`) wraps the native/web
  segmented control with only `tintColor`/`appearance`; on web the unselected
  labels render near-white on the light track and the disabled state is
  unreadable. Check the wrapped component's `fontStyle` / `activeFontStyle`
  (or equivalent) props.
- Slider (`components/Slider.tsx:68`) inactive track is `muted` in light but the
  web render shows a dark track right of the thumb: verify which prop the web
  implementation honors and make the light inactive track `theme.colors.border`.
- Focus rings: only Button, Checkbox, RadioGroup, Tabs, Switch, Toggle,
  TextInput, Select, ToggleGroup use `getFocusRingStyle`; pressable `Card`,
  `Item`, `Accordion` trigger, `Collapsible` trigger have none. Each control
  duplicates the `:focus-visible` gating block (`Button.tsx:296-315`).
- Icon (`components/Icon.tsx:116-123`) passes `accessible`,
  `importantForAccessibility`, `accessibilityElementsHidden` to the SVG on web;
  React logs "Received true for a non-boolean attribute accessible" and "React
  does not recognize the importantForAccessibility / accessibilityElementsHidden
  prop" on every page, and Expo's dev overlay toasts them.
- Off-scale radii: `BottomSheet.tsx:455` `spacing.xl / 2` (16), `DropdownMenu.tsx:391`
  literal `4`; the scale is `radiusXs 4 … radius2xl 24` in `constants/spacing.ts`.
- Docs vs code: `state/themeStore.ts:114` and `packages/ui/README.md` (Shape
  overrides) say the default button radius is 12; `Button.tsx:500` uses
  `spacing.radiusMd` (10).
- `lib/stateSurface.ts` exists; read it before adding helpers.

## Work

1. Skeleton: base `theme.colors.borderStrong`, pulse 0.55 → 1 (reduce motion:
   static at 0.8). `SkeletonText`/`SkeletonCard` inherit. Changed entry.
2. SegmentedControl: unselected label `mutedForeground`, selected label
   `accentForeground`, disabled at `interaction.disabledOpacity` (from the
   press-feedback spec if merged, else 0.5 literal with a TODO-free comment);
   verify on web light/dark.
3. Slider: light inactive track `theme.colors.border`; dark unchanged; confirm
   on web.
4. `hooks/useFocusVisible.ts`: `{ focused, onFocus, onBlur }` with the
   `:focus-visible` gating; adopt in the nine controls (no behavior change) and
   add rings to pressable Card, Item, Accordion trigger, Collapsible trigger.
5. Icon: on web emit only `aria-hidden` (decorative) or `role="img"` plus the
   new optional `accessibilityLabel` prop mapped to `aria-label`; native keeps
   the RN props and forwards `accessibilityLabel`. Zero React DOM prop warnings
   on `/`, `/showcase`, `/components`.
6. Radii: BottomSheet → `spacing.radiusXl`, DropdownMenu literal → `spacing.radiusXs`.
7. Docs: fix "12" → "10 (`spacing.radiusMd`)" in `themeStore.ts:114` and README;
   CHANGELOG Changed entries for 1–3 and 6, Added for `accessibilityLabel`.
   `bun run docs:llms`.

Tests first: Skeleton style snapshot of color/opacity; Icon web props (render
with `Platform.OS = "web"` mocked) contain no RN-only a11y keys; useFocusVisible
unit test; Card/Item focus ring style applied when focused.

## Validation

- `bun run ui:test`, `bun run ui:typecheck`, `bun run typecheck`, `bun run lint`,
  `bun run docs:llms:check`, `bun run verify`.
- Web before/after of Skeleton, SegmentedControl, Slider, Card/Item focus (Tab
  key) sections in light and dark under `/tmp/fleet/ui/expo-ui/visual-audit/`;
  console error log empty for the three prop warnings.

## Out of scope

Serif headings in the showcase (typography spec); SSR stack overflow on gallery
routes (tracked separately in the shift report).

## Open questions

None.
