---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Email-first sign-in creates the account when none exists

## Goal
A user who types an email on the sign-in screen and asks for a code must always receive a real email. Today an unknown address lands on "Check your email. We sent a sign-in code to …" and nothing arrives. The default email-code action becomes a single "Continue" step that signs up new addresses and signs in known ones, so nobody has to know whether they already have an account.

## Context
- Verified against a pool created by `scripts/create-cognito-pool.sh` (Keepwatch, pool `camera-app`, 2026-10-07): the app client has `PreventUserExistenceErrors: ENABLED`, so `InitiateAuth` with `USER_AUTH` + `EMAIL_OTP` for an address not in the pool returns a fake `EMAIL_OTP` challenge and sends no email. CloudTrail showed four such calls with no error; SES and the pool's email configuration were healthy. The `userNotFound` branch in `handleEmailCodeSignIn` (`client/features/auth/components/AuthScreen.tsx`) can never fire against that configuration. Keep existence hiding on; the fix is in the flow.
- Current flow: `SignInForm` (`client/features/auth/components/SignInForm.tsx`) leads with the code layout, button `auth.emailMeACode`, footer "Don't have an account? Sign up" linking to `SignUpForm`. `AuthScreen.handleEmailCodeSignIn` calls `signInWithEmailCode` and moves to `confirm-sign-in-code`. `submitSignUp` (passwordless when `password` is undefined) already handles `needsConfirmation` → `verify-email` with `passwordlessSignUp: true`, and `handleVerify` then requests a sign-in code via `handleEmailCodeSignIn`.
- Provider contract: `client/features/auth/provider/types.ts`. Cognito `signUp({ email })` without a password throws `AuthError("userExists")` for a known address (`UsernameExistsException`), `AuthError("unsupported")` when the pool has no `EMAIL_OTP` first factor. Clerk's `signUp` without a password and `signInWithEmailCode` both throw `unsupported`. `signInWithEmailCode` for an existing unconfirmed account throws `userNotConfirmed`.
- Revealing that an address already has an account is accepted here; sign-up already does it and every email-first product does. Keepwatch (`~/Development/keepwatch`) carries the same auth feature and gets the same change directly; this spec is the template version other consumers pull from.

## Work
1. `AuthScreen.tsx`: add `handleContinueWithEmail({ email })` and pass it as `SignInForm`'s `onEmailCodeSignIn`. Keep `handleEmailCodeSignIn` for the internal "known account, send a sign-in code" step (post-confirmation request and resend).
   - Call `signUp({ email })` with `passwordlessSignUp: true`. Reuse `submitSignUp`'s result handling (extract a shared helper rather than duplicating): `needsConfirmation` → `pendingEmail`, `postVerifyDestination: "sign-in"`, view `verify-email`; `complete` → authenticated store state → `onAuthenticated`, else `handleEmailCodeSignIn`.
   - On `userExists` → `handleEmailCodeSignIn({ email })`. If that throws `userNotConfirmed`, resend the sign-up code (`resendVerificationCode`) and show `verify-email` with `passwordlessSignUp: true` so confirmation leads to a sign-in code, not the password view.
   - On `unsupported` → fall back to `handleEmailCodeSignIn({ email })` unchanged (Clerk and password-only pools behave exactly as today).
   - Other errors → the existing `handleEmailCodeSignIn` error copy (`limitExceeded` etc.).
   - Track where the verify view came from (for example `verifyOrigin: "sign-in" | "sign-up"`) so "Wrong email? Change it" returns to the sign-in view when the flow started there; `goToChangeEmail` currently always goes to `sign-up`.
2. `SignInForm.tsx`: in code mode the button reads `auth.continueWithEmail` ("Continue"); keep `auth.emailMeACode` for the password-mode toggle copy only if still referenced, otherwise remove the key from both locales. Show the "Don't have an account? Sign up" footer only in password mode (`showPasswordField`): in code mode Continue already creates accounts, and the sign-up screen stays reachable via "Use password instead" for people who want a password.
3. Copy in `client/features/i18n/translations/en.ts` and `es.ts`: `signInWithCodeDescription` → "Enter your email and we'll send you a code. New here? This also creates your account." (Spanish equivalent). Add `continueWithEmail`. `checkEmailForCode*` stays.
4. Tests, `client/features/auth/components/__tests__/AuthScreen.test.tsx` (helper `requestEmailCode`): unknown email → `signUp` called with `{ email }`, `verify-email` shown, `signInWithEmailCode` not called until confirmation; `userExists` → `signInWithEmailCode` called, `confirm-sign-in-code` shown with `auth.signInWithCodeButton`; `userExists` then `userNotConfirmed` → `resendCode` called, `verify-email` shown; `unsupported` → `signInWithEmailCode` called directly; `limitExceeded` from `signUp` → friendly copy; "Change it" from a sign-in-originated verify returns to the sign-in view. Update existing tests that assumed `requestEmailCode` calls `signInWithEmailCode` first. `SignInForm.test.tsx`: footer hidden in code mode, shown after the password toggle; button label key.
5. `README.md` line "Sign-in (Cognito)": describe the Continue step (sign-up first, sign-in on `userExists`) and that existence hiding stays on. Run `bun run gen --check`; regenerate if the README is in the LLM bundle list.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci -- client/features/auth`
- `bun run verify`
- Manual, Cognito dev build against a pool from `scripts/create-cognito-pool.sh`: (a) brand-new address → confirmation email arrives, code confirms, session or sign-in code follows; (b) existing confirmed address → sign-in code arrives; (c) address signed up earlier but never confirmed → confirmation code resent, then sign-in code; (d) `EXPO_PUBLIC_AUTH_PROVIDER=clerk` → Continue surfaces the same `unsupported` message as before, password sign-in unaffected.
