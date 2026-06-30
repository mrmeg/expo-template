# Changelog

All notable changes to `@mrmeg/expo-ui` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.1]

### Fixed

- **`BottomSheet` now dismisses the keyboard when tapping outside a focused
  field on Android.** The native sheet hosts its content in a separate window
  (via `@expo/ui`'s `RNHostView`), outside the app's `KeyboardProvider` — so the
  app-wide tap-away never reached sheet content, and `useKeyboardState()` /
  `KeyboardController.dismiss()` are blind to that window. iOS papered over this
  (SwiftUI resigns first-responder on outside taps for free); Compose did not,
  leaving a focused field stuck open. `BottomSheet.Content` now mounts a
  transparent dismiss overlay while a field is focused, detecting focus via the
  window-independent `keyboardFocusRegistry` and resigning the field through its
  own native `blur()` ref. The registry gained `subscribeKeyboardFocus`,
  `hasKeyboardFocusedInput`, and `dismissKeyboardFocusedInput`, and `TextInput`
  now registers a `blur` handle on focus.

## [0.12.0]

### Added

- **`KeyboardAvoidingView` is now a public package component.** Native uses
  `react-native-keyboard-controller` with `automaticOffset` enabled by default,
  while web renders a plain `View`.
- **`UIProvider` now owns app-wide native keyboard avoidance by default.** Apps
  that mount `KeyboardProvider` above `UIProvider` get root-level keyboard
  avoiding behavior without adding per-screen `KeyboardAvoidingView` wrappers.
  Pass `keyboardAvoiding={false}` to opt out, or `keyboardAvoidingProps` to tune
  the root wrapper. Web skips the root keyboard wrapper unless explicitly
  enabled.

### Fixed

- **`DismissKeyboard` no longer nests keyboard-avoiding wrappers when the root
  provider already owns keyboard avoidance.**

## [0.11.0]

### Added

- **New peer dependency: `react-native-keyboard-controller` (>=1.21.0 <2.0.0).**
  Required by `DismissKeyboard` to dismiss the software keyboard for the native
  `@expo/ui` TextInput (see fix below). It ships a no-op web fallback, so web
  bundles are unaffected.

### Fixed

- **`DismissKeyboard` now dismisses the keyboard for native `@expo/ui` fields.**
  The native TextInput is a SwiftUI / Compose field that never registers with
  React Native's `TextInputState`, so the previous `Keyboard.dismiss()` (which
  only blurs RN-tracked inputs) did nothing — tapping outside never closed the
  keyboard on iOS or Android. `DismissKeyboard` now mounts a full-screen
  tap-catcher *only while the keyboard is visible* (`useKeyboardState`) that calls
  `KeyboardController.dismiss()` at the IME level. Mounting it only while visible
  avoids stealing the focus tap and fighting bottom sheets / modals. Web remains a
  no-op (no software keyboard); all existing props (`children`, `style`,
  `avoidKeyboard`, `scrollable`) and the `KeyboardAvoidingView` / `ScrollView`
  wrapping behavior are preserved.
- **Android: TextInput text is now vertically centered.** The native field set a
  fixed `height`, but Android's Compose `BasicTextField` decoration box defaults to
  `contentAlignment = topStart`, so text pinned to the top with the slack falling to
  the bottom (iOS centered fine). The single-line field is now sized by symmetric
  vertical padding instead of a fixed height, centering the text on Android with no
  change to iOS sizing or centering. Multiline is unchanged.

## [0.10.1]

### Fixed

- Fix TextInput rounded-corner fill leak on New Architecture. On Fabric, the
  `outline`/`filled` variants stroked a rounded border but painted the
  background fill as an un-clipped rect, so the fill's square corners poked past
  the rounded stroke (most visible on dark themes and the `filled` variant). The
  fill, border, and radius now live on the RN wrapper `View` with
  `overflow: "hidden"`, and the native `@expo/ui` host renders transparent inside
  that clipped rounded surface. The `underlined` variant (bottom border only),
  error state, `forceLight` mode, and the secure-entry eye toggle are unchanged.

## [0.10.0]

### Added

- Drawer collapsible rail mode (`variant="rail"`, `Drawer.ToggleCollapse`).
- Theme-aware Icon color resolution.
