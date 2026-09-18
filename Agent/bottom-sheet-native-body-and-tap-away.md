---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# `BottomSheet`: tap-away dismissal stops swallowing taps; Android body fills the rendered sheet

## Goal

Inside a `BottomSheet`, taps on controls and other fields reach their targets while the keyboard is up, dead-space taps dismiss on release only (the `DismissKeyboard` contract from 0.24), and no stale "Dismiss keyboard" element survives a dismissal that bypassed the native blur callback. On Android, `BottomSheet.Body` fills the height the Material sheet actually renders instead of a window-percentage strip. Both are blockers for `~/Development/doglog/Agent/bottom-sheet-keyboard-overlay-press-in.md` and `~/Development/doglog/Agent/bottom-sheet-android-detent-body-cap.md`, which wait on a published `@mrmeg/expo-ui`.

## Context

Verified on `dev` at `abd3380` (package 0.25.1).

- **Overlay.** `packages/ui/src/components/BottomSheet.tsx` lines 395–447: `SheetKeyboardDismissOverlay` is an absolute-fill `Pressable` (`zIndex: 999`, `accessibilityLabel="Dismiss keyboard"`) mounted as a sibling after `{children}` (line 668) whenever `hasKeyboardFocusedInput()` is true. Its handler is `onPressIn`, so it dismisses on touch-down and no tap reaches the content beneath it. Doglog reproduced on iOS and a Pixel 6a: mode tabs, the torch toggle, Date/Time buttons and footer Save buttons all hide the keyboard without firing; a second tap is needed. The doc comment (lines 396–420) argues the JS responder chain is not dispatched across `RNHostView` on Android and only `Pressable` hit-testing works — but `Pressable` *is* the responder system, so the bubbling `onStartShouldSetResponder` / `onTouchEnd` pair that `useKeyboardDismissResponder` (`keyboardDismiss.ts`) uses works wherever `Pressable` does, as long as the boundary lives *inside* the hosted tree (the app-level `DismissKeyboard` boundary outside the sheet window genuinely never sees these touches). The two real facts in that comment survive: presence must come from `keyboardFocusRegistry` (keyboard-controller does not observe the sheet window) and dismissal must go through the registered field's own blur handle.
- **Boundary already fits.** `useKeyboardDismissResponder()` arms only when `useKeyboardState().isVisible` **or** `hasKeyboardFocusedInput()`, never claims the responder, ignores touches tagged by `markTextInputTouchStart` (any package `TextInput` surface), cancels on 10-unit travel or multitouch, and dismisses in `onTouchEnd` through `dismissKeyboard()` → `dismissKeyboardFocusedInput()` with a `KeyboardController.dismiss()` fallback. Returns `{}` on web. `DismissKeyboard.tsx` spreads it onto a plain `View`; `keyboardDismiss.test.tsx` shows the touch-event helpers (`touch()`, `Boundary`).
- **Stale registry.** `keyboardFocusRegistry.ts` lines 76–84: `dismissKeyboardFocusedInput()` calls `focusedInput.blur()` and relies on the field's later `onBlur` to `clearKeyboardFocusedInput(token)`. Doglog saw (iOS, walk detail → Trim route sheet) the tree still holding `AXButton "Dismiss keyboard"` after the keyboard was already down, and the first Cancel tap only unmounted the overlay. Consumers call `dismissKeyboard()` from submit handlers per the 0.24 contract, so the blur callback is not guaranteed to arrive (isolated sheet window, iOS secure/plain handoff). `TextInput.tsx` clears on `handleBlur` (line 649) and on unmount (line 721); `clearKeyboardFocusedInput` is already token-guarded so a field that took focus during `blur()` is not wiped.
- **Android cap.** `BottomSheet.tsx` lines 606–615 compute `detentHeight` from the last snap point (`parseFloat("55%") / 100 * windowHeight`) and line 659 applies it as `maxHeight` on the content column for every platform. iOS needs it: `@expo/ui`'s SwiftUI host lays the RN column out at intrinsic height. Android does not: `node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.android.tsx` lines 202–209 wrap children in `<View style={{ flexGrow: 1, height: 0 }}>` inside `<RNHostView matchContents={false}>`, which "fills RNHostView's measured height", and Material's `ModalBottomSheet` ignores percentage snap points (partial/expanded only). Doglog measured a `55%` sheet spanning 0.055–0.974 of the screen with its Body ScrollView capped at 0.161–0.444 and ~37% blank below. Web (`BottomSheet.tsx`, vaul) sizes the panel itself with `height={currentHeight}`; the cap is inert there.
- **Tests.** `packages/ui/src/components/__tests__/BottomSheet.test.tsx` mocks `@expo/ui/community/bottom-sheet` as a `View` with `testID="native-bottom-sheet"` and flips `Platform.OS` with `Object.defineProperty`. `test/setup.ts` mocks `react-native-keyboard-controller` with `__setKeyboardState`. `DismissKeyboard.test.tsx` and `TextInput.android.test.tsx` already import the registry.
- **Docs.** `packages/ui/README.md` line 526 says `BottomSheet.Content` "does mount its own tap-away keyboard-dismiss overlay while a field is focused". `CHANGELOG.md` has an empty `## [Unreleased]`. `llms-full.txt` at the repo root is generated (`bun run docs:llms`) and gated by `docs:llms:check`.

## Work

1. **Replace the overlay with the boundary.** In `BottomSheetContent`, call `const dismissResponderProps = useKeyboardDismissResponder();` (import from `./keyboardDismiss`) and spread it onto the content column `View` (the one with `flex: 1` at line 651). Delete `SheetKeyboardDismissOverlay`, `styles.keyboardDismissOverlay`, the `<SheetKeyboardDismissOverlay />` element, and now-unused imports (`KeyboardController`, `useSyncExternalStore`, `subscribeKeyboardFocus`, `hasKeyboardFocusedInput`, `dismissKeyboardFocusedInput`, `StyleSheet` if nothing else uses it). Rewrite the section comment: the sheet hosts RN children in a separate native window outside the app's `KeyboardProvider`/`DismissKeyboard`, so the sheet mounts its own boundary on the content column; presence comes from the focus registry; the boundary never claims the touch and dismisses on release only.
2. **Token-safe dismissal.** In `keyboardFocusRegistry.ts`, `dismissKeyboardFocusedInput()` captures the current entry, calls its `blur()`, then `clearKeyboardFocusedInput(entry.token)` so presence drops immediately even when the native blur callback never arrives. Update the comment. `TextInput`'s own clears stay (idempotent).
3. **Android body height.** Apply `maxHeight: detentHeight` only when `Platform.OS !== "android"`; Android keeps `flex: 1` alone so the column fills the host's bounded height. Rewrite the comment above `detentHeight` to say why iOS (and web, inert) keep the cap and Android does not; `useWindowDimensions` stays for iOS.
4. **Tests** (`BottomSheet.test.tsx`, plus a `keyboardFocusRegistry.test.ts`):
   - With `setKeyboardFocusedInput(token, blur)` registered and the keyboard mock visible, render an open sheet with a `Pressable` child: nothing is labelled "Dismiss keyboard"; the content column (give it a `testID` via `style`-less prop or locate it as the parent of the children) has `onStartShouldSetResponder` returning `false`; an unclaimed tap (`onStartShouldSetResponder` + `onTouchStart` + `onTouchEnd` at the same point, using `keyboardDismiss.test.tsx`'s `touch()` shape) calls `blur` once and `hasKeyboardFocusedInput()` is then `false`; a tap that travels 12 units before release does not call `blur`; a child-claimed touch (only `onTouchStart`/`onTouchEnd` reach the column, no negotiation) does not call `blur`.
   - Registry: `dismissKeyboardFocusedInput()` returns `true`, invokes `blur`, clears presence and notifies subscribers without any later `clearKeyboardFocusedInput`; when `blur` synchronously registers a second token, that registration survives; with nothing registered it returns `false`.
   - Content column style: on Android (`Platform.OS` flipped as the existing test does) the flattened style has no `maxHeight` and keeps `flex: 1`; on iOS `maxHeight` is `0.55 * windowHeight` for `snapPoints={["55%"]}` and `320` for `snapPoints={[320]}`.
5. **Docs.** README line 526: `BottomSheet.Content` mounts a tap-away keyboard-dismiss boundary on its content column that never claims the touch and dismisses on release, matching `DismissKeyboard`; note that on Android the body fills the rendered sheet height because Material ignores percentage snap points. `CHANGELOG.md` under `## [Unreleased]` → `### Fixed`: sheet taps reach controls with the keyboard up (overlay removed, release-based boundary); `dismissKeyboard()` clears the focus registry immediately; Android sheet bodies fill the rendered sheet. Run `bun run docs:llms` and commit the regenerated files if they changed. Sibling PRs (`icon-lucide`, `android-textinput-password-keyboard`) also append to Unreleased — rebase and keep all entries.

## Validation

- `bun run ui:test` and `bun run verify` green (fresh output).
- `grep -n "Dismiss keyboard\|onPressIn" packages/ui/src/components/BottomSheet.tsx` → only the Handle/Close `useScalePress` press handlers remain.
- Optional device pass (Android emulator `emulator-5554` / AVD `Pixel_10`, or the Pixel 6a `2A271JEGR01748`; `android/app/build/outputs/apk/debug/app-debug.apk` from 2026-09-17 is JS-compatible with this change, so Metro reload suffices): in a sheet with a focused field, tapping a button fires it on the first tap; a dead-space tap hides the keyboard on release; a 2 s hold does not; a `["55%"]` sheet with a long Body scrolls to its last row with no blank strip. iOS simulator: detents unchanged.

## Out of scope

- The Android drag-to-dismiss gap on non-scrolling forms (doglog `keyboard-android-drag-dismiss-nonscrolling-forms.md`, app-side).
- Mapping percentage snap points onto Material partial/expanded states differently.
- Gallery/showcase changes.

## Open questions

None.
