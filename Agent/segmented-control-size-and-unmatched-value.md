---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# SegmentedControl: a 44 pt `size="lg"`, and no selection for an unmatched value

## Goal

Fix two defects in `@mrmeg/expo-ui`'s `SegmentedControl` (0.29.1) that consumer apps reported:

1. **No 44 pt option.** The control is about 32 pt tall on every platform and has no `size` prop, so apps that need
   44 pt targets avoid it. Reported by keepwatch #125, SimpleSell #116 ("the iOS control is about 32 pt tall"), and
   keepwatch `Agent/camera-and-live-rework.md`.
2. **An unmatched value shows the first segment selected.** A controlled `value` that is not in `values` (keepwatch's
   "Custom") renders as if segment 0 were chosen, so the control misreports state.

Add `size?: "md" | "lg"`, where `lg` is a 44 pt control on iOS, Android and web. A `value` (or `defaultValue`) that
is not in `values` selects no segment.

## Context

Verified on `dev` at 156c9a1 (`@expo/ui` 58.0.16).

- `packages/ui/src/components/SegmentedControl.tsx:98`:
  `const selectedIndex = Math.max(0, values.indexOf(value ?? values[0]));`. Any value missing from `values`
  becomes index 0. Leave the documented default alone: uncontrolled with no `defaultValue` still selects the first
  segment.
- **iOS** renders `@expo/ui/community/segmented-control` → `SegmentedControl.ios.tsx` in `node_modules/@expo/ui`.
  That is a SwiftUI `Picker` with `pickerStyle('segmented')` in a `Host` with `matchContents={{ vertical: true }}`,
  so the system sets the height (about 32 pt). The community wrapper accepts no modifiers (no `controlSize`), and an
  RN `hitSlop` cannot widen a native SwiftUI host. The selection is matched by `tag(index)`, so `selection={-1}`
  matches no tag and shows no segment selected.
- **Android** renders a Compose `SingleChoiceSegmentedButtonRow` (`SegmentedControl.android.tsx`). Each button is
  `selected={index === selectedIndex}`, so `-1` selects none.
- **Web** renders the kit's own `WebSegmentedControl` (same file, line 140 on) with `TRACK_HEIGHT = 32` and an
  animated pill driven by `selectedIndex`.
- Precedent: `ThemeSelector.tsx` is drawn in RN on every platform with a 44 pt vertical hit area for exactly this
  reason.
- Tests: `__tests__/SegmentedControl.test.tsx` (jest-expo default platform, iOS) mocks the native control and reads
  `selectedIndex` from `accessibilityValue.now`. `__tests__/SegmentedControl.web.test.tsx` imports
  `./forceWebPlatform` first. For an Android-forced test, copy the `Platform.OS` setup from
  `__tests__/StyledText.android.test.tsx`.
- Template uses: `client/showcase/previews.tsx:274` and `client/showcase/SurfaceLabScreen.tsx:232-258`. None pass an
  unmatched value.
- No open PR touches `SegmentedControl` (#155 server, #156 lint and icons, #157 `TextInput`). #156 and #157 both add
  `packages/ui/CHANGELOG.md` entries, so rebase cleanly over them if they merge first.

## Work

All in `packages/ui/src/components/SegmentedControl.tsx` unless named.

1. **`size` prop.** Add `size?: "md" | "lg"` (default `"md"`) to `SegmentedControlProps`, with JSDoc: `md` is the
   platform control (system height, about 32 pt on iOS); `lg` is the kit-drawn control at `spacing.touchTarget`
   (44) on every platform, for screens that need 44 pt targets. On `lg`, `tintColor` applies on iOS too, and
   `appearance` is ignored (the theme decides), as on web today.
2. **Drawn control on native.** Rename `WebSegmentedControl` / `WebSegment` to `DrawnSegmentedControl` /
   `DrawnSegment` and give the control a `height` prop. Replace `TRACK_HEIGHT` with
   `const TRACK_HEIGHTS = { md: 32, lg: spacing.touchTarget }`. Render it when `Platform.OS === "web" || size === "lg"`,
   with `height={TRACK_HEIGHTS[size]}`. Keep every web-only style behind its existing `Platform.OS === "web"` guard
   (`cursor`, `userSelect`, `outlineStyle`). The focus ring already comes from `useFocusVisible` and is harmless on
   native. Keep segment labels at the current 14/18. Keep `testID="segmented-control"` on the track.
3. **Unmatched value.** Compute
   `const selectedIndex = value === undefined ? 0 : values.indexOf(value);`, so a value not in `values` gives `-1`.
   The empty `values` case gives `-1` or `0` and renders nothing selectable, which is fine.
   - Native `md`: pass `selectedIndex` through unchanged (`-1` selects nothing on iOS and Android).
   - Drawn: when `selectedIndex < 0`, do not render the pill, and give no segment `selected: true`. When the index
     moves from `-1` to a real index, `setValue` the animated position to that index instead of sliding from 0.
     Track the previous index in a ref. Reduced motion is unchanged.
   - `handleValueChange` / `lastIndex` stay as they are. The haptic still fires on the first real selection.
   - Update the `defaultValue` JSDoc: "Defaults to the first segment. A value not in `values` selects none."
4. **Docs.**
   - Update the class JSDoc block: web, plus `size="lg"` on every platform, draws the kit control.
   - `packages/ui/LLM_USAGE.md:414` row: add "`size="lg"` = 44 pt drawn control; a value not in `values` selects
     none".
   - `packages/ui/LLM_USAGE.md:189` sizes line: add "`SegmentedControl` `md` ≈32 (native) / `lg` 44".
   - `packages/ui/README.md:42`: say `SegmentedControl` is native except `size="lg"`.
5. **Showcase.** In `client/showcase/previews.tsx` near line 274, add a second example
   `<SegmentedControl size="lg" values={["List", "Grid", "Map"]} defaultValue="List" />`.
6. **CHANGELOG** (`packages/ui/CHANGELOG.md`, under `## [Unreleased]`, no version bump):
   - `### Added`: "`SegmentedControl` `size="lg"`: a 44 pt control drawn by the kit on iOS, Android and web (the
     native control's height is fixed by the system at about 32 pt)."
   - `### Fixed`: "`SegmentedControl` no longer shows the first segment selected when `value` (or `defaultValue`)
     is not one of `values`; no segment is selected."
7. Run `bun run gen` if any source doc in `scripts/build-llms-full.mjs` changed (`LLM_USAGE.md`, `README.md`), and
   commit the regenerated files.

Exclusions: no per-segment `disabled` (keepwatch also wanted it; out of scope), no change to `ThemeSelector`, no
version bump.

## Validation

Write each test first and watch it fail on `dev`.

- `packages/ui/src/components/__tests__/SegmentedControl.test.tsx` (iOS default):
  - A controlled `value="Custom"` with `values={["Light","Dark"]}` passes `selectedIndex` `-1` to the native mock.
    It fails before: the mock gets `0`.
  - Uncontrolled with no `defaultValue` still passes `0`.
  - `size="lg"` renders `getByTestId("segmented-control")` with a flattened `height` of 44 and does not render the
    native mock (`queryByTestId("segmented")` is null). It fails before (the prop is ignored).
  - On `size="lg"`, pressing a segment calls `onValueChange` with its label.
- New `__tests__/SegmentedControl.android.test.tsx` (Android forced): the same unmatched-value and `size="lg"`
  assertions.
- `__tests__/SegmentedControl.web.test.tsx`:
  - An unmatched value gives no segment `accessibilityState.selected === true` (`aria-selected`) and no pill. It
    fails before: the first segment is selected.
  - `size="lg"` gives a 44 track, and the default gives 32.
  - Selecting a segment after an unmatched value marks that segment selected.
- `bun run pkg ui test`, `bun run pkg ui typecheck`, `bun run gen --check` and `bun run verify` all pass.
- Manual (record in the PR): open the components gallery's `SegmentedControl` detail.
  - iOS simulator: the `lg` example is 44 pt and selects. The `md` example is unchanged.
  - Android emulator: the same checks.
  - Web: check against `bun run build && bun run start`.
  - iOS: a temporary unmatched value shows no selected segment and logs no crash. A SwiftUI "selection is invalid"
    console warning is acceptable; note it if it appears.
