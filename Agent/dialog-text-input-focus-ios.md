---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/104
---

# Dialog: `TextInput` fields inside `DialogContent` never mount on iOS

## Goal

Fields inside `DialogContent` / `AlertDialogContent` take focus on the first tap on iOS, the keyboard appears, and the dialog keeps its fields and footer visible above it. Android and web behavior is unchanged. Document who owns keyboard avoidance for a dialog.

## Context

Reported by fieldnest (`Agent/start-trip-modal-keyboard-avoidance.md`, iOS 27 simulator, `@mrmeg/expo-ui` 0.27.0): the odometer and purpose fields inside a `Dialog` took no focus across four taps, no keyboard appeared, and the accessibility tree listed only the field labels — no editable element. `keyboard-focused-tap-swallowed-by-pickers-ios` passed on 0.27.0, so this is Dialog-specific.

Verified in code (device reproduction is step 1 of Work):

- `packages/ui/src/components/Dialog.tsx:13,54,240` wraps both `DialogContent` and `AlertDialogContent` in react-native-screens' `FullWindowOverlay` on iOS (`React.Fragment` elsewhere), inside `DialogPrimitive.Portal`.
- `node_modules/react-native-screens/ios/RNSFullWindowOverlay.mm` `maybeShow` adds its container view straight to the `UIWindow` (`[window addSubview:_container]`). Nothing above that container is a `UIViewController`.
- The package `TextInput` on iOS is `@expo/ui`'s SwiftUI field (`nativeTextField.tsx`, `TextInput.tsx` `NativeTextInput`), rendered by `expo-modules-core`'s `ExpoSwiftUI.HostingView`. Its `didMoveToWindow` (`node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift:225-241`) attaches the `UIHostingController` only when `reactViewController()` finds a parent controller; otherwise it removes the hosting view from the hierarchy. Inside the overlay container that lookup returns nil, so the SwiftUI field is never in the view tree: no editable AX element, nothing to tap, `focus()` is a no-op. `Slider` and `SegmentedControl` share the `@expo/ui` host and are blank inside a Dialog for the same reason.
- `UIProvider.tsx:68` mounts `PortalHost` as a sibling of its `KeyboardAvoidingView`, so nothing avoids the keyboard for a dialog; `useKeyboardAvoidance()` is `false` inside portal content.
- `BottomSheet` documents its keyboard rule (platform owns avoidance; `Content` owns tap-away dismissal). `Dialog` documents nothing.
- Tests: no `Dialog.test.tsx`. `overlayContentBounds.test.tsx` and `Drawer.test.tsx` mock `react-native-screens` `FullWindowOverlay` inline and are the model. `test/setup.ts` mocks `@expo/ui` `TextInput` as an RN `TextInput`, so a `TextInput` inside `DialogContent` is queryable in Jest.
- App harness: `client/showcase/details.tsx` `Dialog` entry has one variant (confirm dialog, no fields); route `/components/Dialog`.

Constraints: `main` publishes on push — never touch it. `packages/ui/CHANGELOG.md` `## [0.27.1]` is written but unreleased: add under its `### Fixed`, do not bump `package.json`. No `Agent/` files in the PR diff. Do not add `react-native-reanimated`/`worklets` imports to the package (`check:forbidden-imports`).

## Work

1. Reproduce in the template app on one self-booted iPhone simulator (dev client + Metro from the worktree). Add a `form` variant to the `Dialog` entry in `client/showcase/details.tsx`: a `Dialog` whose content has two package `TextInput`s (odometer, numeric; purpose) and a `DialogFooter` with `DialogClose` Cancel + Save. Record (a) with no focused field on the screen, (b) with a screen field focused before opening, (c) with `FullWindowOverlay` temporarily replaced by `Fragment`. Confirm the cause with `native-describe-screen` (no text field under the overlay container). Extend the `usage` snippet for the entry if it helps consumers; keep the existing `dialog` variant.
2. Fix `packages/ui/src/components/Dialog.tsx`: on iOS present `DialogContent` and `AlertDialogContent` through React Native's `Modal` (`visible`, `transparent`, `animationType="none"`, `presentationStyle="overFullScreen"`, `supportedOrientations` covering portrait and landscape, `onRequestClose` → `useRootContext().onOpenChange(false)`) instead of `FullWindowOverlay`; keep `DialogPrimitive.Portal` (open gating, `portalHost`) and the existing Overlay/fade/scale/Content tree inside. `Modal` presents a real view controller above native stack modals, so z-order is preserved and `ExpoSwiftUI.HostingView` finds its parent controller. Android and web keep `React.Fragment` — no `Modal` there. One shared presenter component for both dialogs.
3. Keyboard avoidance rule: on iOS the dialog is presented outside `UIProvider`'s root `KeyboardAvoidingView`, so `DialogContent`/`AlertDialogContent` own it there: wrap the centered container in the package `KeyboardAvoidingView` (`behavior="padding"`, `keyboardVerticalOffset={0}`) inside the Modal so the card recenters above the keyboard and `useKeyboardAvoidance()` is `true` inside (a `DismissKeyboard` in dialog content adds no second layer). Android/web: unchanged this ticket (portal host sits outside root avoidance; note as follow-up in the CHANGELOG entry). If keyboard-controller's view does not track the keyboard inside the Modal on device, fall back to RN core `KeyboardAvoidingView` for this wrapper only and say so in the docs.
4. Tests: new `packages/ui/src/components/__tests__/Dialog.test.tsx` — iOS: `DialogContent` and `AlertDialogContent` render a `Modal` (transparent, overFullScreen, none) and no `FullWindowOverlay`; a `TextInput` inside `DialogContent` is reachable and `focus` fires; the keyboard-avoiding wrapper is present (`useKeyboardAvoidance()` true inside content); `onRequestClose` closes. Android and web (`Platform.OS` forced per file, see `forceWebPlatform.ts` / `TextInput.android.test.tsx`): no `Modal`, tree unchanged. Add a `client/showcase` assertion only if `galleries.test.tsx` needs it for the new variant.
5. Docs: `packages/ui/README.md` — Dialog rule in the component notes near the BottomSheet paragraph (iOS presents in a native `Modal`, owns keyboard avoidance there, never wrap dialog content in another `KeyboardAvoidingView`; Android/web portal-host caveat; `@expo/ui`-hosted controls — `TextInput`, `Slider`, `SegmentedControl` — do not render inside `FullWindowOverlay`, which `Drawer`, `Popover`, `Select`, `DropdownMenu`, `Tooltip` still use: follow-up). `packages/ui/CHANGELOG.md` `## [0.27.1]` `### Fixed` entry with the root cause and device evidence. Re-run `bun run docs:llms` if any listed doc changed.
6. Report whether fieldnest `start-trip-modal-keyboard-avoidance` items (a) focus, (b) portal keyboard avoidance, (c) tap-away in `DialogContent` are unblocked: (a) yes on iOS; (b) iOS yes / Android follow-up; (c) not in this ticket.

## Validation

- Device (iOS simulator, template dev client, `/components/Dialog` `form` variant): first tap on each field focuses it and raises the keyboard; both fields and the footer stay visible with the keyboard up; typing lands in the field; Cancel/backdrop close the dialog; the `dialog` variant and an `AlertDialog` still open and close; a `Select`/`Popover` opened from screen content is unaffected.
- `bun run ui:typecheck`, `bun run ui:test`, `bun run ui:build`, `bun run packages:peer-check`, root `bun run typecheck`, `bun run lint`, `bun run test:ci --maxWorkers=2`, `bun run docs:llms:check`; `bun run ui:consumer-smoke` if the script exists (it does not today — record that).
- Android: no code path changes (`Platform.OS === "ios"` gate); no device check required unless shared code moves.

## Out of scope

- Android dialog keyboard avoidance (portal host outside root avoidance) and tap-away dismissal inside `DialogContent` — follow-up spec.
- `Drawer`, `Popover`, `Select`, `DropdownMenu`, `Tooltip` still use `FullWindowOverlay`; moving them is a separate decision.
- Upstream fix in `expo-modules-core` (fall back to `window.rootViewController` like the macOS path) — file/mention, do not wait for it.
- Releasing 0.27.1.

## Open questions

None.
