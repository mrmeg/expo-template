---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# `BottomSheet.Body` must not let RN's ScrollView swallow the first tap while a sheet field is focused

## Goal

With a `TextInput` focused inside a `BottomSheet`, the first tap on a chip, button, tab or other field inside `BottomSheet.Body` reaches its target on iOS as it already does on Android. Today RN's `ScrollView` inside `Body` claims that tap in the capture phase (default `keyboardShouldPersistTaps="never"`) and blurs the field on release instead. `Body` should hand tap-away dismissal to the boundary `BottomSheet.Content` already owns, exactly as `DismissKeyboard` does.

## Context

Verified on `dev` at f59d2fa (`@mrmeg/expo-ui` 0.26.0, the commit that published 0.26.0; CI green on that commit).

**What 0.26.0 already fixed.** The consumer reports (tractor `Agent/bottomsheet-keyboard-dismiss-overlay-swallows-taps.md`, doglog `Agent/bottom-sheet-keyboard-overlay-press-in.md`, both written against 0.24.0/0.25.1) blame `SheetKeyboardDismissOverlay`, an absolute-fill `Pressable` that dismissed on `onPressIn`. Commit 4f691ba (#90) removed it; the published 0.26.0 tarball's `dist/components/BottomSheet.js` has no `SheetKeyboardDismissOverlay`, and `BottomSheet.Content` spreads the release-based `useKeyboardDismissResponder()` boundary onto its content column (`packages/ui/src/components/BottomSheet.tsx:552`, `:628`). `BottomSheet.test.tsx` covers that boundary ("keyboard dismiss boundary" cases). Bumping a consumer to 0.26.0 answers the overlay half of those reports.

**Residual root cause (code-proven, not yet device-observed on 0.26.0).**

- `BottomSheetBody` renders RN `ScrollView` without `keyboardShouldPersistTaps` (`packages/ui/src/components/BottomSheet.tsx:782-805`), so RN's default `never` applies.
- RN `ScrollView._handleStartShouldSetResponderCapture` (`node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js:1583-1616`): with `never`, `_keyboardIsDismissible()` true and a non-text-input target, the ScrollView claims the responder in the capture phase, so the child never receives the touch; `_handleResponderRelease` (`ScrollView.js:1472-1481`) then blurs the focused input on release. Net effect: first tap dismisses, second tap fires — the symptom the consumers describe, now release-based instead of press-in.
- `_keyboardIsDismissible` (`ScrollView.js:1623-1641`) needs (a) a focused input registered with RN `TextInputState` and (b) `_keyboardMetrics` from RN `Keyboard` events, or Android API < 30.
  - (a) holds on both platforms: `@expo/ui` registers every hosted field's `Host` with `TextInputState` (`node_modules/@expo/ui/src/keyboard/index.tsx:87` `registerInput`, `:134` `focusInput`), used by `swift-ui/Host`, `jetpack-compose/Host`, `swift-ui/TextField`, `swift-ui/SecureField` and `jetpack-compose/TextField/shared.ts:229` (`BasicTextField`, which the package's Android field `nativeTextField.android.tsx` is built on).
  - (b) holds on iOS: RN's iOS keyboard events are process-wide `UIKeyboard*Notification`s (`node_modules/react-native/React/CoreModules/RCTKeyboardObserver.mm:36`), so they fire for a keyboard raised in the sheet's window. It does not hold on Android API >= 30: `ReactRootView.checkForKeyboardEvents` (`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactRootView.java:934-945`) reads the main root view's `ime()` insets, and the Material sheet is its own dialog window (`node_modules/@expo/ui/android/src/main/java/expo/modules/ui/ModalBottomSheetView.kt:66-70`), so `_keyboardMetrics` stays null there. Android API < 30 arms unconditionally (`ScrollView.js:1653-1657`).
- Package precedent and documentation: `DismissKeyboard.tsx:43` sets `keyboardShouldPersistTaps="always"` for exactly this reason (comment `:19-24`); `packages/ui/README.md:116-126` and `packages/ui/LLM_USAGE.md:78` tell consumers to use `always` on any scroll view under a package boundary. `Body` is such a scroll view and does not follow the rule.
- The boundary on the `Content` column is an ancestor of `Body`, so with `always` an unclaimed dead-space tap inside `Body` still bubbles to it and dismisses on release; a drag past `MOVE_SLOP` (`keyboardDismiss.ts:37`) still does not.

**Consumer exposure.**

- tractor: `CatalogFilterSheet.tsx:116`, `ReviewForm.tsx:110`, `LeadModal.tsx:181` render `BottomSheet.Body` with no `keyboardShouldPersistTaps` — the chips (`filter-chip-in-stock`), stars (`star-3`), "Text us" and field-to-field handoff live inside `Body`, so behaviors 1 and 2 of their matrix would still fail on iOS after a bare 0.26.0 bump. Footer buttons (`filter-apply`, `review-submit`, `lead-submit`) are outside the ScrollView and are fixed by 0.26.0 alone.
- doglog: `AddFoodSheet.tsx:1364` passes `keyboardShouldPersistTaps="handled"`; with `handled` the capture handler returns false and only dead space is claimed (`ScrollView.js:1548-1556`), so its controls already fire. It is the control case for device verification.
- fieldnest: its sheets (`client/components/app-ui/Select.tsx`, `JobDocumentationTimeline.tsx`, `QuickActionsFAB.tsx`) hold no text fields. Not affected.

**Web**: `useKeyboardDismissResponder` returns `{}` on web and `keyboardShouldPersistTaps` is inert in react-native-web. No web behavior change.

## Work

1. `packages/ui/src/components/BottomSheet.tsx`, `BottomSheetBody` (`:782-805`): pass `keyboardShouldPersistTaps="always"` on the `ScrollView` **before** `{...props}` so an explicit consumer value still wins. Add a short comment mirroring `DismissKeyboard.tsx:19-24`: the `Content` boundary owns tap-away dismissal; RN's `never`/`handled` policies would claim or blur independently. Leave `keyboardDismissMode` and `onScrollBeginDrag` untouched.
2. Header doc block (`BottomSheet.tsx:24-56`): under the platform-owned list, add one line that `Body` disables RN's ScrollView tap dismissal and why.
3. Tests in `packages/ui/src/components/__tests__/BottomSheet.test.tsx` (RN's jest ScrollView mock forwards props to the `RCTScrollView` host, `node_modules/@react-native/jest-preset/jest/mocks/ScrollView.js:52-58`, so `screen.getByTestId("sheet-body").props.keyboardShouldPersistTaps` reads the rendered value):
   - `Body` renders `keyboardShouldPersistTaps="always"` by default.
   - A consumer's `keyboardShouldPersistTaps="handled"` is preserved.
   - With a registered focused field (`setKeyboardFocusedInput(token, blur)`, keyboard-controller state visible as in the existing "keyboard dismiss boundary" `setup()`), a `Pressable` inside `Body` fires on `fireEvent.press` and `blur` is not called (same shape as "does not dismiss a touch a child claimed", with the control inside `Body`).
   - With a `Body` mounted, an unclaimed dead-space tap on the column (`onStartShouldSetResponder`/`onTouchStart`/`onTouchEnd` on `sheet-column`) still calls `blur` once and clears `hasKeyboardFocusedInput()`.
4. Docs: `packages/ui/README.md` BottomSheet bullet (`:568-578`) — add that `BottomSheet.Body` uses `keyboardShouldPersistTaps="always"` so the column boundary owns dismissal, and that consumers should not pass `never`. Same sentence in `packages/ui/LLM_USAGE.md` near `:86`. Run `bun run docs:llms` and commit the regenerated `llms-full.txt`.
5. `packages/ui/CHANGELOG.md` under `## [Unreleased]`, `### Fixed`: "`BottomSheet.Body` no longer swallows the first tap on its controls while a sheet field is focused on iOS…" (name the RN `never` capture and that Android >= 30 was already unaffected). No version bump; no publish.

## Validation

- `bun run typecheck` clean.
- `bunx jest packages/ui/src/components/__tests__/BottomSheet.test.tsx` — existing 16 tests plus the four above pass.
- `bun run lint` and `bun run docs:llms:check` clean (the latter after regenerating).
- `cd packages/ui && bun run test` (package suite + `check:forbidden-imports`).

### Device verification (consumer repro, after the next release is bumped in)

- tractor, iOS simulator, `@mrmeg/expo-ui` at the release containing this fix: `CatalogFilterSheet` — focus `filter-max-price`, tap `filter-chip-in-stock`: chip toggles on the first tap, keyboard stays up. `ReviewForm` — focus `review-title`, tap `star-3`. `LeadModal` — focus `lead-email`, tap "Text us", then tap `lead-message` (handoff moves focus). Empty-space tap inside the body dismisses on release; a short drag does not. Re-run behaviors 1, 2, 3, 7 of `Agent/expo-ui-0.24-keyboard-device-verification.md` in the three sheets.
- tractor, AVD `Pixel_10` (API 36): same taps pass both before and after this change (Android >= 30 was not exposed); confirms no regression.
- doglog `AddFoodSheet` (already `handled`): behavior unchanged.

### Release (human step, Matt)

Patch release (0.26.1): bump `packages/ui/package.json`, move the `[Unreleased]` entry under a new heading, publish. Consumers then bump: tractor closes `Agent/bottomsheet-keyboard-dismiss-overlay-swallows-taps.md` on this release (0.26.0 alone leaves the iOS in-body taps failing); doglog's `Agent/bottom-sheet-keyboard-overlay-press-in.md` is already satisfied by 0.26.0 (PR #46) and needs nothing further from this spec.

## Merge plan

`Agent/bottom-sheet-keyboard-avoidance.md` edits the same file, tests, README and changelog section. Land this spec first; rebase the other on it.

## Out of scope

- Drag-to-dismiss inside sheets (`dismissKeyboardOnDrag` stays accepted-and-ignored; doglog's B3 expects a short drag not to dismiss, tractor's matrix treats sheets as non-drag surfaces).
- Keyboard avoidance for `Body`/`Footer` (sibling spec).
- fieldnest's iOS picker first-tap defect (`keyboard-focused-tap-swallowed-by-pickers-ios.md`) — not a sheet.

## Open questions

None.
