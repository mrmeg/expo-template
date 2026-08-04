---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Add missing auth i18n keys + key-drift guard

## Goal

Auth screens render raw key strings (`auth.signInTitle`, …) because the five auth form components reference 46 `auth.*` and 5 `errors.*` keys that exist in neither locale file. Add the keys (en + es) and a regression test so referenced-but-undefined keys can't ship again.

## Context

- Components use **untyped** `useTranslation()` from react-i18next (e.g. `SignInForm.tsx:3,49`); the typed `TxKeyPath` union only guards the standalone `translate()` helper (`client/features/i18n/translate.ts:18`), and there's no `CustomTypeOptions` augmentation — so drift is invisible to tsc. i18next returns the key string on miss (en itself lacks the keys, so `fallbackLng` doesn't help).
- Exactly two locales, identical structure: `client/features/i18n/translations/en.ts` and `es.ts` (both 120 lines; `auth:` at 20-37, `errors:` at 38-50). `en.ts` exports `type Translations = typeof en`, which drives `TxKeyPath` automatically.
- Missing keys by consumer (same set missing from both files):
  - `SignInForm.tsx`: `auth.signInTitle`, `signInDescription`, `continueWithGoogle`, `continueWithApple`, `continueWithGithub`, `continueWith`, `signIn`, `or`, `signUp`
  - `SignUpForm.tsx`: `signUpTitle`, `signUpDescription`, `namePlaceholder`, `createPasswordPlaceholder`, `confirmPasswordPlaceholder`, `createAccountButton`
  - `ForgotPasswordForm.tsx`: `forgotPasswordTitle`, `forgotPasswordDescription`, `checkYourEmail`, `resetLinkSentDescription`, `didntReceiveEmail`, `backToSignIn`, `sendResetLink`
  - `ResetPasswordForm.tsx`: `resetYourPassword`, `resetYourPasswordDescription`, `passwordResetSuccess`, `passwordResetSuccessDescription`, `verificationCode`, `verificationCodePlaceholder`, `newPassword`, `newPasswordPlaceholder`, `confirmNewPassword`, `confirmNewPasswordPlaceholder`, `passwordMinLength`, `resetPasswordButton`
  - `VerifyEmailForm.tsx`: `verifyEmailTitle`, `verifyEmailDescription`, `enterAllDigits`, `codeDigitsOnly`, `enterDigitCode`, `verifyEmailButton`, `didntReceiveCode`, `resendIn`, `sending`, `resendCodeLink`, `wrongEmail`, `changeIt`
  - `errors.*` (used across the forms): `codeRequired`, `confirmPasswordRequired`, `nameRequired`, `nameTooShort`, `passwordMinLength`
- `auth.resendIn` is called with `{ count: cooldown }` (`VerifyEmailForm.tsx:150`) — supply `{{count}}` interpolation (and `_one`/`_other` plural forms if the copy needs them; it's a seconds countdown, so "Resend in {{count}}s" avoids pluralization entirely — implementer's call after seeing the UI).
- The existing 16 `auth.*` keys are a legacy set (`login`, `welcomeBack`, …) that nothing in the auth forms references; `errors.passwordTooShort` is likewise unreferenced. Leave legacy keys in place (other screens may use them — verify before any removal; removal is optional cleanup, not required).
- No i18n tests exist anywhere (`client/features/i18n/__tests__/` absent). Jest picks up any `**/__tests__/**/*.test.ts`.
- Verify the exact key lists against the components rather than trusting this spec's inventory — line refs: SignInForm 53-54/93-99/176/183/207-211, SignUpForm 53-54/121-127/153/191/215/236/271, ForgotPasswordForm 49-50/100-121/171-179, ResetPasswordForm 51-52/122-134/162-163/179-180/203-204/219/231, VerifyEmailForm 62-63/79-82/121/141-174.

## Work

1. Add every missing key to the `auth`/`errors` blocks of `en.ts` and `es.ts`, matching each file's existing style. Write real Spanish for `es.ts` (the file is fully translated today — no English placeholders).
2. Add `client/features/i18n/__tests__/translationKeys.test.ts`:
   - en/es structural parity (same key paths in both).
   - Every `t("...")` / `translate("...")` string literal under `client/features/auth/` resolves to a defined string in `en` (scan the source files in the test; static literals only). Widening the scan to all of `client/` is welcome if it passes without whitelisting dynamic keys.
3. Optional hardening if cheap: add the react-i18next `CustomTypeOptions` module augmentation binding `t()` to the `Translations` type, so this class of drift becomes a tsc error. Only do this if it doesn't cascade type errors outside auth; otherwise note it as a follow-up in the PR.

## Validation

- `bun run verify` passes (includes the new test).
- iOS simulator or web with any auth provider env set enough to render the form (`EXPO_PUBLIC_AUTH_PROVIDER=clerk` renders the UI shell even without full keys — verify): sign-in screen shows real copy, no raw `auth.*` strings. If no auth surface can render without real keys, assert via a component test (`render(<SignInForm/>)` and query for "auth.signInTitle" absence) instead, and say so in the PR.
- Language switch to Español in Settings shows the Spanish strings on a translated screen (Settings itself suffices).

## Out of scope

- Removing the legacy unused `auth.*`/`errors.passwordTooShort` keys.
- Adding locales beyond en/es.
- Auth flow behavior changes.

## Open questions

- None.
