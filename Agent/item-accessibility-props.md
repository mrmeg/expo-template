---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Item: pass accessibility props, `testID` and `ref` through

## Goal

`@mrmeg/expo-ui`'s `Item` accepts only `children`, `onPress`, `disabled`, `separator` and `style`. A pressable row
cannot be given an accessible label, a hint, custom accessibility actions, a `testID` or a `ref`. Relata had to build
a local `ItemPressable` (a Pressable around a static `Item`) for its accessible contacts list and map search
(mrmeg/mindmap PR #116). That workaround cost the row its scale-on-press, and the gap is recorded in the vault note
`Relata.md` → Quirks. Let `Item` take these props so a pressable row is one accessible element with a name, a hint,
actions and a test handle.

The `TextInput` half of the same Quirks line ("native TextInput drops `accessibilityLabel`") is covered by draft
PR #157 and is excluded here.

## Context

Verified on `dev` at 156c9a1.

- `packages/ui/src/components/Item.tsx:136-150`: `ItemProps` is
  `{ children, onPress, disabled, separator, style }`.
- `Item.tsx:177-241`:
  - The pressable branch (`onPress` set) renders a `Pressable` with `accessibilityRole="button"`,
    `accessibilityState={{ disabled }}`, the scale-press handlers and the focus handlers.
  - The static branch returns `content`, which is the row `View`, or a wrapper `View` holding the row and the
    separator.
  - No consumer props reach either branch.
- React 19: `ref` is a plain prop (see `Button.tsx:88-95` for the kit's convention).
- react-native-web maps `accessibilityLabel` → `aria-label` and `testID` → `data-testid`. It drops
  `accessibilityHint` and `accessibilityActions` (Relata #116 "Platform limits found"), so those are native-only,
  which is fine.
- `Item`'s title machinery (`ItemLabelContext`, `useItemControlLabel`) names *controls inside* the row from
  `ItemTitle`. It is unrelated to the row's own label, so leave it as is.
- Tests: `packages/ui/src/components/__tests__/Item.test.tsx` (iOS default; `import "@/test/mockTheme"`). There is
  no web or Android `Item` test. Use `./forceWebPlatform` for web, and copy the `Platform.OS` setup from
  `StyledText.android.test.tsx` for Android.
- No open PR touches `Item.tsx`. #156 and #157 add `packages/ui/CHANGELOG.md` entries.

## Work

1. **`ItemProps`** (`packages/ui/src/components/Item.tsx`) gains:
   - `accessibilityLabel?: string`, `accessibilityHint?: string`,
     `accessibilityActions?: PressableProps["accessibilityActions"]`,
     `onAccessibilityAction?: PressableProps["onAccessibilityAction"]`.
   - `testID?: string`.
   - `ref?: React.Ref<View>`.

   JSDoc: the accessibility props apply to a pressable row (`onPress` set), which is the one accessible element. A
   static row is not an accessible element, so they are ignored there. Inner controls stay reachable. `testID` and
   `ref` apply to both. Hint and actions are native-only (react-native-web drops them).
2. **Pressable branch.** Pass the four accessibility props, `testID` and `ref` to the `Pressable`. Keep
   `accessibilityRole="button"` and the existing `accessibilityState`.
3. **Static branch.** Put `testID` and `ref` on the outermost `View` of `content` (the wrapper when `separator`
   shows, otherwise the row). Do not set `accessible` or any label there.
4. **Docs.**
   - `packages/ui/LLM_USAGE.md:403` `Item` row: add "a pressable row takes `accessibilityLabel` / `Hint` /
     `accessibilityActions`, `testID`, `ref`".
   - Update the `Item` JSDoc example if useful.
5. **CHANGELOG** (`packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Fixed`, no version bump): "`Item` passes
   `accessibilityLabel`, `accessibilityHint`, `accessibilityActions`, `onAccessibilityAction`, `testID` and `ref`
   to its row (the `Pressable` when `onPress` is set). They were silently dropped, so apps wrapped `Item` in their
   own Pressable and lost its press feedback."
6. Run `bun run gen` if `LLM_USAGE.md` feeds `llms-full.txt` (`scripts/build-llms-full.mjs`), and commit the output.

Exclusions: no change to `ItemGroup`, `ItemTitle` labelling or `TextInput`; no version bump.

## Validation

Write the tests first and watch them fail on `dev` (TypeScript rejects the props, and at runtime they are dropped).

- `__tests__/Item.test.tsx` (iOS):
  - A pressable `Item` with `accessibilityLabel="Ada Lovelace, Acme"`, `accessibilityHint="Opens the contact"`,
    `accessibilityActions={[{ name: "open", label: "Open contact" }]}` and `testID="row-1"`:
    `getByLabelText("Ada Lovelace, Acme")` is the element with `testID` `row-1`, its role is `button`, and the hint
    and actions props are on it.
  - `fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "open" } })` calls
    `onAccessibilityAction`.
  - A `ref` created with `React.createRef<View>()` is non-null after render, for both a pressable and a static row.
  - A static row with `testID` exposes it, with and without `separator`, and has no `accessible` prop.
- New `__tests__/Item.android.test.tsx`: the label, the action and `testID` on a pressable row.
- New `__tests__/Item.web.test.tsx` (`./forceWebPlatform`): a pressable row renders `aria-label` and
  `data-testid`; the existing focus ring and `cursor` behavior is unchanged.
- `bun run pkg ui test`, `bun run pkg ui typecheck`, `bun run gen --check` and `bun run verify` pass.
- Manual (record in the PR): on the iOS simulator, VoiceOver on a gallery `Item` row given a temporary label reads
  the label and hint, and the rotor lists the action. Web: on `bun run build && bun run start`, the row's
  accessible name in the browser's accessibility tree is the label.
