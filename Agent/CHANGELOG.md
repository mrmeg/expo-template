# Changelog

## [Unreleased]

- Fixed pre-existing Jest failures (react-test-renderer pin, expo-font / vector-icons / safe-area-context mocks, Progress accessibility role, Switch thumb tree assertion, InputOTP onComplete via simulated changeText).
- Fixed web media delete: shared CORS helper now advertises `DELETE` so browser preflights to `DELETE /api/media/delete?key=...` succeed from allowed origins. Added regression coverage in `app/api/_shared/__tests__/cors.test.ts`.
- Fixed false-positive client env warnings on web by validating `EXPO_PUBLIC_*` values with Expo-compatible direct property access.
- Disabled RN core `useNativeDriver` on web to remove repeated dev warnings from showcase and demo animations.
- Blurred focused web navigation elements before route changes to avoid `aria-hidden` warnings when hidden screens retained focus.
- Fixed the web accordion wrapper so uncontrolled accordions no longer flip into controlled mode on first toggle.
