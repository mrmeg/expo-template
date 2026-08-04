---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/35
---

# Add missing auth i18n keys + key-drift guard

## Goal

Auth screens render raw key strings (`auth.signInTitle`, …) because the five auth form components reference 46 `auth.*` and 5 `errors.*` keys that exist in neither locale file. Add the keys (en + es) and a regression test so referenced-but-undefined keys can't ship again.

## Context

- Components use **untyped** `useTranslation()` from react-i18next (e.g. `SignInForm.tsx:3,49`); the typed `TxKeyPath` union only guards the standalone `translate()` helper (`client/features/i18n/translate.ts:18`), and there's no `CustomTypeOptions` augmentation — so drift is invisible to tsc. i18next returns the key string on miss (en itself lacks the keys, so `fallbackLng` doesn't help).
- Exactly two locales, identical structure: `client/features/i18n/translations/en.ts` and `es.ts` (both 120 lines; `auth:` block at lines 20-37, `errors:` at 38-50 in **both** files; verified 100 identical key paths, zero drift today). `en.ts` exports `type Translations = typeof en`, which drives `TxKeyPath` automatically.
- `es.ts` writes accented characters as **`\uXXXX` escapes**, not literal UTF-8 (e.g. `login: "Iniciar sesión"`). Match that style for every new Spanish string.
- Missing keys by consumer (same set missing from both files):
  - `SignInForm.tsx`: `auth.signInTitle`, `signInDescription`, `continueWithGoogle`, `continueWithApple`, `continueWithGithub`, `continueWith`, `signIn`, `or`, `signUp`
  - `SignUpForm.tsx`: `signUpTitle`, `signUpDescription`, `namePlaceholder`, `createPasswordPlaceholder`, `confirmPasswordPlaceholder`, `createAccountButton`
  - `ForgotPasswordForm.tsx`: `forgotPasswordTitle`, `forgotPasswordDescription`, `checkYourEmail`, `resetLinkSentDescription`, `didntReceiveEmail`, `backToSignIn`, `sendResetLink`
  - `ResetPasswordForm.tsx`: `resetYourPassword`, `resetYourPasswordDescription`, `passwordResetSuccess`, `passwordResetSuccessDescription`, `verificationCode`, `verificationCodePlaceholder`, `newPassword`, `newPasswordPlaceholder`, `confirmNewPassword`, `confirmNewPasswordPlaceholder`, `passwordMinLength`, `resetPasswordButton`
  - `VerifyEmailForm.tsx`: `verifyEmailTitle`, `verifyEmailDescription`, `enterAllDigits`, `codeDigitsOnly`, `enterDigitCode`, `verifyEmailButton`, `didntReceiveCode`, `resendIn`, `sending`, `resendCodeLink`, `wrongEmail`, `changeIt`
  - `errors.*` (used across the forms): `codeRequired`, `confirmPasswordRequired`, `nameRequired`, `nameTooShort`, `passwordMinLength`
- Keys taking `{ count }` need `{{count}}` interpolation: `auth.resendIn` (`VerifyEmailForm.tsx:150`), `auth.enterAllDigits` (79), `auth.enterDigitCode` (121), `auth.passwordMinLength` (`ResetPasswordForm.tsx:219`), `errors.passwordMinLength` (`SignInForm.tsx:75` count 6, `SignUpForm.tsx:90` count 8, `ResetPasswordForm.tsx:70` `minPasswordLength`). **i18next applies plural resolution whenever `count` is a number** (`intl-pluralrules` is loaded in `client/features/i18n/index.ts:16`), so a bare `key: "…"` with no `_one`/`_other` siblings still resolves via the plain-key fallback — safe. Simplest correct choice: single non-plural strings that read fine for any count ("Resend in {{count}}s", "Enter all {{count}} digits", "At least {{count}} characters"). Other `{{…}}` interpolations needed: `auth.continueWith` `{{provider}}`, `auth.resetLinkSentDescription` `{{email}}`, `auth.verifyEmailDescription` `{{email}}`.
- The 16 existing `auth.*` keys split: **9 are referenced** by the forms (`email`, `emailPlaceholder`, `password`, `passwordPlaceholder`, `confirmPassword`, `name`, `forgotPassword`, `noAccount`, `hasAccount`) — do not touch these. 7 are unreferenced legacy (`login`, `logout`, `register`, `welcomeBack`, `loginSubtitle`, `createAccount`, `signupSubtitle`), as are 7 `errors.*` (`generic`, `network`, `passwordTooShort`, `invalidCredentials`, `emailInUse`, `loginFailed`, `registrationFailed`). Leave all legacy keys in place; removal is out of scope.
- No i18n tests exist anywhere (`client/features/i18n/__tests__/` absent). Jest picks up any `**/__tests__/**/*.test.ts` (`jest.config.js` testMatch).
- **Inventory verified against the components** — the 46 `auth.*` + 5 `errors.*` lists above are exact and complete as of this spec. Line refs: SignInForm 53-54/75/93-99/176/183/207-211, SignUpForm 53-54/66-100/121-127/153/191/215/236/271, ForgotPasswordForm 49-50/100-121/171-179, ResetPasswordForm 51-52/60-80/122-134/162-163/179-180/203-204/219/231, VerifyEmailForm 62-63/79-82/120-121/141-174.

## Work

1. Add every missing key to the `auth`/`errors` blocks of `en.ts` and `es.ts`, matching each file's existing style. Write real Spanish for `es.ts` (the file is fully translated today — no English placeholders).
2. Add `client/features/i18n/__tests__/translationKeys.test.ts`:
   - en/es structural parity (same key paths in both).
   - Every `t("...")` / `translate("...")` string literal under `client/features/auth/` resolves to a defined string in `en`. Scan with `fs`/`path` + a regex over the `.tsx` files and walk into the imported `en` object; static literals only. Widening the scan to `app/` + all of `client/` is welcome if it passes (`app/(main)/(tabs)/settings.tsx` is the only other `t()` consumer today and its `settings.*` keys all exist).
   - Note: `test/setup.ts:266-278` mocks `react-i18next` so `useTranslation().t` is the identity function `(key) => key`. This test must import the translation modules directly and not rely on a live i18next instance.
3. Do **not** add a react-i18next `CustomTypeOptions` augmentation. Verified against i18next 26.3.6 / react-i18next 17.0.11: adding `resources: { translation: Translations }` makes `t()` reject the existing `translate()` wrapper (`client/features/i18n/translate.ts:18`) with TS2345 — the typed overloads no longer accept `(key: TxKeyPath, options?: TOptions)` because a union key plus an optional-`TOptions` second arg collides with the `(key, defaultValue: string, options?)` overload. Fixing that means reworking `translate()`'s signature, which is outside this spec. Note it as a follow-up in the PR body instead; the new test is the drift guard.

## Validation

- `bun run verify` passes (includes the new test).
- **No auth env needed**: all five forms render on the component showcase at `/(main)/(demos)/showcase` under the "Auth Forms" section (`app/(main)/(demos)/showcase/index.tsx:254`, `1553-1690`) — a `ToggleGroup` switches between signin/signup/verify/forgot/reset. Open it on iOS simulator or web and confirm every form shows real copy with no raw `auth.*`/`errors.*` strings (trigger the validation errors by submitting empty fields).
- Language switch to Español in Settings, then re-open the showcase Auth Forms section: Spanish copy on all five forms.

## Out of scope

- Removing the legacy unused `auth.*`/`errors.*` keys listed in Context.
- Adding locales beyond en/es.
- Auth flow behavior changes.
- Reworking `translate()`'s signature to enable a `CustomTypeOptions` augmentation (PR follow-up note).

## Open questions

- None.
