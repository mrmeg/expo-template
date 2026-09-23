---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Dialog: tap-away keyboard dismissal inside `DialogContent` and `AlertDialogContent`

## Goal

A tap on dead space inside a `Dialog` or `AlertDialog` (card padding, labels, the area between fields and footer, the backdrop) dismisses the software keyboard on iOS and Android without stealing the tap from controls or fields inside the dialog. Web is unchanged (no software keyboard).

## Context

fieldnest start-trip matrix cell B3: with a dialog field focused, tapping outside the inputs inside the dialog leaves the keyboard up. Verified in code:

- `packages/ui/src/components/Dialog.tsx`: `DialogContent` and `AlertDialogContent` render `DialogPresentation > Overlay > AnimatedView(fade) > DialogKeyboardAvoidance > View(overlayStyles.centeredContainer) > AnimatedView(scale, sizer) > Primitive.Content`. No touch handler dismisses the keyboard; on iOS the content is inside an RN `Modal`, outside any app-level `DismissKeyboard`, so an app boundary never sees these touches.
- The package's boundary is `useKeyboardDismissResponder()` in `packages/ui/src/components/keyboardDismiss.ts`: spread onto a wrapper `View`, never claims the responder (`onStartShouldSetResponder` returns `false`), arms only when a keyboard is visible or a package `TextInput` is registered in `keyboardFocusRegistry`, ignores touches tagged by the package `TextInput` surface, and dismisses on release of an unclaimed single-finger tap within 10 units through the registered field's blur handle with a `KeyboardController.dismiss()` fallback. Returns `{}` on web. `DismissKeyboard` and `BottomSheet.Content` use it; `BottomSheet.test.tsx` "keyboard dismiss boundary" and `DismissKeyboard.test.tsx` are the test models (`test/setup.ts` mocks `react-native-keyboard-controller` with `__setKeyboardState`).
- `Dialog.test.tsx` exists (mocks RN `Modal` as a tagged `View`, `renderDialog`/`renderAlertDialog` helpers, iOS/Android/web describes).
- Consumer `...props` land on `Primitive.Content`; `gap: spacing.md` on the card means no extra `View` may wrap `children` inside the card.

Constraints: no version bump, `main` untouched, CHANGELOG under `## [Unreleased]` (`### Fixed`). No `Agent/` files in the PR diff. Nothing new inside the card's child list.

## Work

1. RED tests in `Dialog.test.tsx`, new describe "keyboard dismiss boundary" for `DialogContent` and one case for `AlertDialogContent`: locate the boundary node by props (`onStartShouldSetResponder` + `onTouchEnd`, as `DismissKeyboard.test.tsx` does) inside the rendered dialog; with `setKeyboardFocusedInput(token, blur)`: (a) the boundary never claims (`false`) and mounts no overlay; (b) start + end of an unclaimed dead-space tap calls `blur` once and clears focus presence; (c) a tap that moves 12 units does not dismiss; (d) a `Pressable` inside the card fires on the first tap (`fireEvent.press`) and `blur` is not called; (e) a touch tagged by `markTextInputTouchStart` (a tap on a package field) is left alone; (f) same boundary present on Android (`Platform.OS = "android"`), absent behavior on web (`useKeyboardDismissResponder` returns `{}`; assert no `onTouchEnd` prop on the container).
2. `Dialog.tsx`: call `useKeyboardDismissResponder()` in `DialogContent` and `AlertDialogContent` and spread the props onto the `overlayStyles.centeredContainer` `View` (both dialogs). That view covers the card and the backdrop: on the backdrop the primitive `Overlay` `Pressable` still claims and closes the dialog while the boundary's `onTouchEnd` drops the keyboard; inside the card, controls, `Close`/`Action`/`Cancel` and fields win the negotiation. Give the container a stable `testID` only if the by-props query is not enough.
3. Docs: `README.md` Dialog bullet (~633) and `LLM_USAGE.md` Dialog paragraph: dialog content owns tap-away dismissal (same boundary as `DismissKeyboard`/`BottomSheet.Content`); do not wrap dialog content in `DismissKeyboard` for that. CHANGELOG `## [Unreleased]` `### Fixed` entry (fieldnest B3). `bun run docs:llms` if `LLM_USAGE.md` changed.

## Validation

- `bun run ui:typecheck`, `bun run ui:test` (red → green), `bun run ui:build`, root `bun run typecheck`, `bun run lint`, `bun run docs:llms:check`.
- Device optional (pool iPhone simulator, showcase `/components/Dialog` `form` variant): focus a field, tap the card padding → keyboard hides, dialog stays; tap Save/Cancel with the keyboard up → fires on the first tap.

## Out of scope

- Android dialog keyboard avoidance (`Agent/dialog-android-keyboard-avoidance.md`).
- Boundaries for `Drawer`, `Popover`, `Select`, `DropdownMenu`, `Tooltip`.

## Open questions

None.
