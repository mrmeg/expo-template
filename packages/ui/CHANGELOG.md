# Changelog

All notable changes to `@mrmeg/expo-ui` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.0]

### Added

- **New composition primitives: `SectionHeader`, `StatCard`, and `Item`.**
  `EmptyState` was also upgraded with richer layout options as part of the
  same pass.
- **Typography system.** The package now loads Inter with real weights and a
  letter-spacing scale via `useResources`, replacing synthetic bolding.
- Motion tokens, dual-layer shadow tokens, and softer radii in the design
  tokens.

### Changed

- Interaction sweep across components: press feedback, focus rings, and
  shadow adoption.
- Updated all `@rn-primitives/*` dependencies from `~1.4.0` to `~1.5.2`,
  picking up upstream's native accessibility overhaul: menus, popovers, and
  dialogs are now usable with VoiceOver/TalkBack (focus moves into opened
  content, escape gestures dismiss), toggles and switches announce the
  correct state, and `nativeID` plumbing that broke Reanimated exiting
  animations was removed.

## [0.14.0]

### Changed

- Aligned the declared compatibility floor with the package's `@expo/ui`
  requirement: Expo 56+, React Native 0.85+, and their matching Expo modules.
- Kept Expo 57 and React Native 0.86 support in the same compatibility window.
- Removed the duplicate workspace dev copy of
  `react-native-keyboard-controller`; the root consumer now supplies the peer
  consistently for tests, builds, and native autolinking.

## [0.13.0]

### Added

- **`Drawer.Header` now supports a compact app-brand layout.** Use the new
  `icon`, `title`, and `action` slots for a leading brand icon and title with a
  trailing close or `Drawer.ToggleCollapse` control. Existing child-based
  headers remain supported.

### Changed

- Expanded peer compatibility through Expo 57, React Native 0.86, and their
  matching `@expo/ui` and gesture-handler releases.

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
