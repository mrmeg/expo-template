---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Dialog: keyboard avoidance on Android

## Goal

A `Dialog` / `AlertDialog` with a focused field keeps its fields and footer above the software keyboard on Android, matching the iOS behavior shipped in 0.27.1. Web unchanged. Documented owner of dialog keyboard avoidance on every platform.

## Context

`packages/ui/CHANGELOG.md` 0.27.1 and `README.md` (~657) state the gap: "Android and web render dialog content inline into the portal host, which sits outside the root avoidance, so an Android dialog does not avoid the keyboard yet."

Verified in code:

- `packages/ui/src/components/Dialog.tsx` `DialogKeyboardAvoidance` wraps the centered container in the package `KeyboardAvoidingView` (`behavior="padding"`, `keyboardVerticalOffset={0}`) on iOS only and returns a Fragment elsewhere. `DialogPresentation` renders through the primitive `Portal` off iOS, into `UIProvider`'s `PortalHost`.
- `packages/ui/src/components/UIProvider.tsx:54-68`: `PortalHost` is a sibling of the root `KeyboardAvoidingView`, so nothing pads portal content; `useKeyboardAvoidance()` is `false` inside dialog content on Android.
- The package requires `react-native-keyboard-controller`'s `KeyboardProvider` above `UIProvider` on native (`llms.txt`, README setup). On Android keyboard-controller takes over the window's IME insets (`EdgeToEdgeReactViewGroup`, `SOFT_INPUT_ADJUST_RESIZE` with consumed insets), so the RN root does not shrink for the keyboard and only keyboard-controller-driven views move — which is why the portal-hosted dialog stays put. `app.config.ts` sets no `softwareKeyboardLayoutMode` (Expo default `resize`).
- `KeyboardAvoidingView.tsx` is the keyboard-controller view on native; it reads the main-window IME, which is where the Android dialog content lives (inline portal, same window). This is the same wrapper iOS uses inside its `Modal`.
- What `@expo/ui` 58.0.2 Compose exposes (`node_modules/@expo/ui/src/jetpack-compose`): `AlertDialog` and `BasicAlertDialog` (Material3 dialogs in their own window; props `onDismissRequest`, `properties: DialogProperties` incl. `decorFitsSystemWindows`, `modifiers`), the `imePadding()` modifier (`modifiers/index.ts:126`), `RNHostView` to host RN children inside Compose, and `ModalBottomSheet`. A Compose dialog window has no JS keyboard signal (the same constraint the sheet documents), and RN content inside it depends on `RNHostView`'s size re-report (`expo-modules-core` ≥ 57.0.4, see `bottomSheetHostSupport.ts`).
- Tests: `Dialog.test.tsx` has an Android describe asserting "no Modal and no avoidance owner" (`avoided:false`) — that assertion flips.
- App harness: `client/showcase/details.tsx` `DialogFormVariant` (two package `TextInput`s + footer), route `/components/Dialog`.

Options considered:

- A (chosen). Extend `DialogKeyboardAvoidance` to Android: same package `KeyboardAvoidingView` (`behavior="padding"`, `keyboardVerticalOffset={0}`) around the centered container inside the portal-rendered overlay. Keyboard-controller observes the main-window IME on Android and the dialog is in the main window, so the padding shrinks the centered container and the card recenters above the keyboard exactly as on iOS; `useKeyboardAvoidance()` becomes `true` inside dialog content on Android, so a `DismissKeyboard` there adds no second layer. Smallest change, reuses the iOS path.
- B. Present the Android dialog through RN `Modal` like iOS. RN's Android `Modal` is a separate `Dialog` window; keyboard-controller's `ModalAttachedWatcher` sets `SOFT_INPUT_ADJUST_NOTHING` on it and the package would still need a keyboard-controller view inside. More moving parts; `@expo/ui` Compose controls inside an RN Modal window are unverified. Fallback only if A fails on device.
- C. Rebuild the dialog on `@expo/ui` `BasicAlertDialog` + `RNHostView` + `imePadding()`. Material-owned avoidance, but a different presentation (own window, Material chrome, no primitive `Overlay`/portal semantics) and the hosted-column caveats from the sheet. Out of scope.

Constraints: no version bump, `main` untouched, CHANGELOG under `## [Unreleased]` (`### Fixed`). No `Agent/` files in the PR diff. Android device testing uses only the fleet Pixel 6a through `device-lock.sh acquire pixel`; native builds only inside `native-slot.sh`.

## Work

1. RED tests in `Dialog.test.tsx` Android describe: `DialogContent` and `AlertDialogContent` render the package `KeyboardAvoidingView` around the centered container (`avoided:true` from the probe), still no `Modal`, still inside the `PortalHost`; web stays `avoided:false`.
2. `Dialog.tsx`: `DialogKeyboardAvoidance` returns the `KeyboardAvoidingView` for `Platform.OS !== "web"` (keep `behavior="padding"`, `keyboardVerticalOffset={0}`, `overlayStyles.fill`). Update its doc comment.
3. Device check on the Pixel 6a (template dev client from the worktree, Metro with a private `adb reverse` mapping, removed afterwards): `/components/Dialog` `form` variant. Record: tap each field → keyboard shows, card recenters, both fields and the footer visible, typing lands; tap-away dismissal still works (`Agent/dialog-keyboard-dismiss-boundary.md`); Cancel/Save fire on the first tap with the keyboard up; the `dialog` variant and an `AlertDialog` unchanged; a dialog opened from a screen wrapped in `DismissKeyboard` shows no double shift. If the card does not move, check `useKeyboardState` inside the dialog reports the keyboard (keyboard-controller sees the main window) before considering option B.
4. Docs: `README.md` Dialog bullet and `LLM_USAGE.md` Dialog paragraph: the dialog owns keyboard avoidance on iOS and Android (package `KeyboardAvoidingView` inside the dialog; `useKeyboardAvoidance()` true in dialog content; never wrap dialog content in another `KeyboardAvoidingView`); web has none. Remove the "does not avoid the keyboard yet" caveat. CHANGELOG `## [Unreleased]` `### Fixed` with the device evidence. `bun run docs:llms`.

## Validation

- `bun run ui:typecheck`, `bun run ui:test`, `bun run ui:build`, root `bun run typecheck`, `bun run lint`, `bun run docs:llms:check`.
- Device matrix above on the Pixel 6a; iOS has no code-path change (same wrapper, already device-verified in 0.27.1).

## Out of scope

- Option C (Compose-hosted dialog).
- `Drawer`, `Popover`, `Select`, `DropdownMenu`, `Tooltip` keyboard behavior.
- Releasing 0.27.2.

## Open questions

None.
