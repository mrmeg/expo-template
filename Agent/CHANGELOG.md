# Changelog

## [Unreleased]

- Fixed false-positive client env warnings on web by validating `EXPO_PUBLIC_*` values with Expo-compatible direct property access.
- Disabled RN core `useNativeDriver` on web to remove repeated dev warnings from showcase and demo animations.
- Blurred focused web navigation elements before route changes to avoid `aria-hidden` warnings when hidden screens retained focus.
- Fixed the web accordion wrapper so uncontrolled accordions no longer flip into controlled mode on first toggle.
