---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/101
---

# Android: pin `collapsable={false}` on every plain `View` whose opacity is state-driven

## Goal

`Button`, `TextInput`, `Slider`, `InputOTP` and `Switch` express `disabled` / `pending` / `checked` state as `opacity` on a plain RN `View`. On Android (Fabric) a state flip on such a View changes whether it forms a stacking context, and the differentiator re-parents its children into or out of the grandparent. Racing that with a navigation pop produced `addViewAt: cannot insert view … View already has a parent` and a red box (doglog PR #57, 2026-09-22, Pixel 6a). Fix: every package surface whose `opacity` (or `pointerEvents`) is computed from state sets `collapsable={false}` on Android, through one shared helper, guarded by tests. No version bump; CHANGELOG under `## [0.27.1]`.

## Context

Verified on `dev` at 29f81d2 (`@mrmeg/expo-ui` 0.27.0, RN 0.88.0-rc.0, Expo 58).

- **Fabric flattening rule** (`node_modules/react-native/ReactCommon/react/renderer/components/view/ViewShadowNode.cpp` `ViewShadowNode::initialize`): a View **forms a stacking context** when `!collapsable`, `pointerEvents` is `none`/`box-only`, `accessible`, `opacity != 1`, a transform, `zIndex` on a non-static position, `display: none`, `overflow != visible`, any native event prop (responder/touch/pointer handlers set `events.bits`), `nativeID`, `importantForAccessibility != auto`, `removeClippedSubviews`, `cursor`, filter/mixBlendMode/isolation, or (Android) `elevation != 0`. It merely **forms a view** (native view exists, but its children are hoisted into the nearest stacking-context ancestor) when it has only `backgroundColor`, a border, `testID`, `boxShadow`, `backgroundImage` or `outlineWidth`. Layout-only Views form nothing. `onLayout` forms neither. So a bordered/filled surface whose only stacking-context prop is a state-driven `opacity` flips between "children hoisted" and "children owned" on every state change; that re-parent mutation is the doglog crash. `collapsable={false}` makes the View a permanent stacking context, so the tree shape never changes.
- **RN `Pressable` already sets `collapsable={false}`** on its host View (`node_modules/react-native/Libraries/Components/Pressable/Pressable.js:362`), and every `@rn-primitives` root/item/trigger this package styles with a state opacity renders a `Pressable` natively (`Checkbox.Root`, `Switch.Root`, `RadioGroup.Item`, `Toggle.Root`, `ToggleGroup.Item`, `Tabs.Trigger`, `Select.Trigger`/`Item`, `DropdownMenu.Item`/`CheckboxItem`/`RadioItem`; `node_modules/@rn-primitives/*/dist/*.js`). Those surfaces are not candidates and need no change. `BottomSheet.tsx:700` (`opacity: pressed ? 0.65 : 1`) is a `Pressable` style and is owned by the sibling `bottom-sheet-android-ime-column` spec: do not touch `BottomSheet`.
- **Candidates (plain `View`s, state-driven opacity), verified line by line:**
  | File | View | State prop | Why it flips today |
  |---|---|---|---|
  | `packages/ui/src/components/Button.tsx:364` | surface `<View style={[styles.button, …]}>` inside the `Pressable` | `isDisabled && styles.disabled` (0.6), `state.pressed && styles.pressed` (0.9) | fill/border only → forms view, children hoisted into the Pressable at opacity 1. **This is the doglog surface.** |
  | `Button.tsx:401` | content `<View style={[styles.content, loading && styles.loadingContent, { pointerEvents: loading ? "none" : "auto" }]}>` | `loading` → opacity 0 + `pointerEvents: none` | layout-only at rest (no view at all), stacking context while pending → the `pending` flip |
  | `TextInput.tsx:857` (native field path, `surfaceStyle` at `:800`) | rounded surface View | `editable === false ? 0.6 : 1` | already a permanent stacking context (`overflow: "hidden"` and the responder props from `useTextInputSurfaceResponder`), so it does not flip today; pin it anyway so the guarantee does not depend on those two staying |
  | `Slider.tsx:98` | wrapper `<View style={[{ opacity: disabled ? 0.5 : 1, alignSelf: "stretch" }, styleOverride]}>` | `disabled` | layout-only at rest, view when disabled |
  | `InputOTP.tsx:263` | cell View inside the cell `Pressable` | `disabled ? 0.5 : 1` | border only → forms view, children hoisted at opacity 1 |
  | `Switch.tsx:207` and `:259` | `labelOn` / `labelOff` Views | `props.checked ? 1 : 0` / `0 : 1` | `styles.label` has `pointerEvents: "none"` so they are permanent stacking contexts; pin for the same reason as TextInput |
- **Not candidates, leave alone:** `Text` nodes with opacity (`Label`/`Checkbox`/`RadioGroup` `disabledLabel`, `DropdownMenu` shortcut), `Animated.View` opacities (`Checkbox` check, `Tabs` underline, `Skeleton`, `Progress`, `Notification`, `useStaggeredEntrance`), static opacities (`TextInput.nativeHostHandoff`, `InputOTP.hiddenInput` on an RN `TextInput`), the web `TextInput` branch (`styles.disabled` on an RN `TextInput`, web only), `Drawer` backdrop (animated).
- **Tests.** Root `jest.config.js` uses preset `jest-expo` (iOS by default); Android tests flip `Platform.OS = "android"` in `beforeEach` and restore it in `afterEach`, and the component must read `Platform.OS` at render time (pattern: `packages/ui/src/components/__tests__/StyledText.android.test.tsx`, `TextInput.android.test.tsx`). `test/setup.ts:75` mocks `@expo/ui` (`Host` → passthrough `View`, `TextInput` → RN `TextInput`); `@expo/ui/community/slider` is not mocked anywhere yet. `TextInput.android.test.tsx:30` shows the native-field mock that exercises the `:857` surface.
- **Docs.** `packages/ui/README.md` `### Patterns And Gotchas` (`:553`, first bullet is the Button preset bullet), `packages/ui/LLM_USAGE.md` `## Component Selection Rules` (`:277`). `packages/ui/CHANGELOG.md` has `## [Unreleased]` then `## [0.27.0]`; the sibling spec adds `## [0.27.1]` with `### Fixed` under `## [Unreleased]`. `bun run docs:llms` regenerates `llms-full.txt` from `LLM_USAGE.md`; `docs:llms:check` gates it.
- **Harness.** `client/showcase/ShowcaseScreen.tsx:1329` `ButtonStatesSection` has a Disabled button and a Loading button that flips `loading` back after 2 s, on the `showcase` route (pushed from the home tab, so it can be popped). `android/app/build/outputs/apk/debug/app-debug.apk` is from 2026-09-17 and predates the `react-native-svg` native dependency: a device check needs a fresh `expo run:android` debug build in the native slot. At spec time host load was 238 (1-min); the build slot needs < 40.

## Work

1. **Helper** `packages/ui/src/lib/stateSurface.ts` (new; import only `Platform` and `ViewProps` from `react-native`):
   ```ts
   export function stateSurfaceProps(): Pick<ViewProps, "collapsable"> {
     return Platform.OS === "android" ? { collapsable: false } : {};
   }
   ```
   Doc comment: what a "state surface" is (plain `View` whose `opacity`/`pointerEvents`/`display` is computed from state), the Fabric rule above in two sentences, the doglog error string, and that `Pressable` already does this itself. Read `Platform.OS` at call time (tests flip it). Export from `packages/ui/src/lib/index.ts` (public via `@mrmeg/expo-ui/lib` and the root barrel).
2. **Apply** `{...stateSurfaceProps()}` to the six Views in the table, placed before any consumer prop spread so a caller can still override: `Button.tsx:364` surface and `:401` content; `TextInput.tsx:857` surface (before `{...surfaceResponderProps}`); `Slider.tsx:98` wrapper; `InputOTP.tsx:263` cell; `Switch.tsx:207` and `:259` label Views. One-line comment at the Button surface pointing at the helper's doc; no comment elsewhere. Do not change any style or state logic, and do not touch `BottomSheet.tsx`.
3. **Tests.**
   - `packages/ui/src/lib/__tests__/stateSurface.test.ts`: android → `{ collapsable: false }`; ios and web → `{}`; restore `Platform.OS` in `afterEach`.
   - `packages/ui/src/components/__tests__/stateSurfaces.android.test.tsx` with `Platform.OS = "android"` for every case, theme/haptics mocks as in `Button.test.tsx`/`InputOTP.test.tsx`, the `@expo/ui` native-field mock pattern from `TextInput.android.test.tsx`, and `jest.mock("@expo/ui/community/slider", …)` rendering a plain `View`. A shared assertion `expectStateSurfacesPinned(root)` walks the rendered host tree (`root.UNSAFE_getAllByType(View)` or `screen.toJSON()`) and asserts every host `View` whose flattened style contains an `opacity` key has `collapsable === false`. Cases: `Button` disabled, `Button` loading, `TextInput editable={false}`, `Slider disabled`, `InputOTP disabled`, `Switch checked labelOn="On" labelOff="Off"` (default variant; iOS variant hides the labels). Plus one enabled-state case per component asserting the same surface (located by its resting style: Button `minHeight`, Button content `pointerEvents: "auto"`, TextInput `overflow: "hidden"`, Slider `alignSelf: "stretch"`, InputOTP cell `borderWidth`, Switch label `position: "absolute"`) is already `collapsable === false`, so a state change never alters the tree shape. One iOS case: `Button disabled` with `Platform.OS = "ios"` has no `collapsable` prop on the surface (the fix is Android-only).
   - Do not add `testID`s to package components (`testID` itself forms a view).
4. **CHANGELOG** `packages/ui/CHANGELOG.md`: add `## [0.27.1]` under `## [Unreleased]` if the sibling has not already (do **not** change `packages/ui/package.json` `version`), `### Fixed` bullet: "**Android state surfaces no longer re-parent their children on a `disabled` / `pending` / `checked` flip.** `Button` (surface and content), `TextInput`, `Slider`, `InputOTP` and `Switch` labels express state as `opacity` on a plain `View`; on Fabric a View whose only stacking-context prop is that opacity has its children hoisted into the parent while the opacity is 1 and pulled back when it changes, and a flip racing a navigation pop crashed with `addViewAt: cannot insert view … View already has a parent` (doglog #57, Pixel 6a). Those Views now set `collapsable={false}` on Android so the native tree shape is fixed. iOS and web are unchanged. `stateSurfaceProps()` from `@mrmeg/expo-ui/lib` is the same guard for app-owned surfaces; `Pressable` already pins itself."
5. **Docs.** `packages/ui/README.md` `### Patterns And Gotchas`: one bullet after the Button preset bullet stating the rule (a plain `View` whose `opacity`/`pointerEvents` follows state must be `collapsable={false}` on Android; the package does this for its surfaces; spread `stateSurfaceProps()` on your own; `Pressable` already does). `packages/ui/LLM_USAGE.md` `## Component Selection Rules`: one-line version of the same rule. Run `bun run docs:llms` and commit the regenerated `llms-full.txt`.

## Validation

- `bun run ui:typecheck`, `bun run ui:test`, `bun run ui:build`, `bun run packages:peer-check`, root `bun run typecheck`, `bun run lint`, `bun run test:ci -- --maxWorkers=2`, `bun run docs:llms:check`, all green from fresh output.
- Device (best effort, own Pixel_10-class AVD, template debug build in the native slot): open `showcase`, dump the view hierarchy (`describe` / uiautomator) of the "Disabled Button" and the "Click to Load" button before and after the fix. Before: the label of the enabled button sits directly under the Pressable's `ReactViewGroup` (hoisted past the surface) while the disabled button's label is one level deeper; after: both nest identically. Then tap "Click to Load" and press back while it is pending, ten times, with no red box. If the slot or load rule blocks the build, say so: verification is unit-level and the device check moves to the doglog Release with `@mrmeg/expo-ui` 0.27.1.

## Out of scope

- `BottomSheet` (sibling spec owns it); `Pressable`-based roots (already pinned by RN); `Animated.View` opacities; a lint rule (the render tests are the guard); any change to iOS/web output; version bump or publish.

## Merge plan

The sibling `agent/bottom-sheet-android-ime-column` also edits `packages/ui/CHANGELOG.md` (`## [0.27.1]` → `### Fixed`), `README.md` and `LLM_USAGE.md`. On conflict keep both bullets under the single `## [0.27.1]` heading and both doc bullets; never drop the other's lines.

## Open questions

None.
