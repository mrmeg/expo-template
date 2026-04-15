# Changelog

## [Unreleased]

- Wired the app shell to auth and onboarding: new `client/features/app/` module (`useAppStartup`, `AuthGate`, `OnboardingGate`, `isAuthEnabled`) owns startup sequencing and per-surface auth policy. Splash stays visible until fonts, i18n, onboarding, and (optionally) Amplify bootstrap have resolved. Onboarding is rendered inline by the root layout on first run — the main Stack never mounts during onboarding. Profile and Settings tabs wrap their exports in `<AuthGate>`, so signing out replaces those tabs with `AuthScreen` inline while unprotected surfaces stay browsable. The template remains fully explorable without Cognito env vars. Added unit coverage for `isAuthEnabled` and `AuthGate`.
- Fixed pre-existing Jest failures (react-test-renderer pin, expo-font / vector-icons / safe-area-context mocks, Progress accessibility role, Switch thumb tree assertion, InputOTP onComplete via simulated changeText).
- Fixed upload rate-limit alignment: the strict 10-requests-per-minute limiter now covers `/api/media/getUploadUrl` (the real presigned-upload route). Configuration moved to `server/rateLimits.js` with regression coverage so the path cannot drift back to the stale `/api/media/upload-url`.
- Fixed web media delete: shared CORS helper now advertises `DELETE` so browser preflights to `DELETE /api/media/delete?key=...` succeed from allowed origins. Added regression coverage in `app/api/_shared/__tests__/cors.test.ts`.
- Fixed false-positive client env warnings on web by validating `EXPO_PUBLIC_*` values with Expo-compatible direct property access.
- Disabled RN core `useNativeDriver` on web to remove repeated dev warnings from showcase and demo animations.
- Blurred focused web navigation elements before route changes to avoid `aria-hidden` warnings when hidden screens retained focus.
- Fixed the web accordion wrapper so uncontrolled accordions no longer flip into controlled mode on first toggle.
