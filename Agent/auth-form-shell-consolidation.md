---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Extract the shared shell from the five auth forms

## Goal
The five auth form components (~1,550 LOC) each re-implement the same card
shell, keyboard/scroll wrapper, validators, and ~80%-identical stylesheets.
Extract the shared scaffolding into the auth components folder, cutting an
estimated 400–600 LOC and making the next form trivial to add. Also fix the
dead-i18n title bug in VerifyEmailForm.

## Context
All under `client/features/auth/components/`:
- `SignInForm.tsx` 324, `SignUpForm.tsx` 376, `VerifyEmailForm.tsx` 282,
  `ForgotPasswordForm.tsx` 255, `ResetPasswordForm.tsx` 310 LOC.
- Repeated per form: a near-identical ~18-line import block; the
  KeyboardAvoidingView + ScrollView "embedded vs standalone" wrapper (inline
  in three forms, a `wrapContent` helper in ForgotPassword/ResetPassword);
  the logo + `Card` + `CardHeader` + error-banner shell; ~60-line
  stylesheets with ~80% identical keys; `validateEmail` copied 3×,
  `validatePassword` 3× (min-length differs — parameterize),
  `validateConfirmPassword` 2×, `getSocialLabel` 2× (SignIn/SignUp).
- VerifyEmailForm bug (verified): line 49 defaults the prop
  (`title = "Verify your email"`), so line 62's
  `title ?? t("auth.verifyEmailTitle")` never falls through — the i18n key is
  dead and the Spanish translation (es.ts:76) unreachable. Line 63 uses `||`
  for description where the pattern elsewhere is `??`.

Constraints that MUST hold:
- All new shared modules live inside `client/features/auth/components/` (or a
  subfolder) and are statically imported by the forms only. They must join
  the existing single lazy auth-components chunk — do not import them from
  the eager graph and do not add a second dynamic-import split point.
  Guardrail tests:
  `client/features/auth/components/__tests__/authComponentsSplitPoint.test.ts`
  (barrel export lines + consumer import specifiers) and
  `client/features/auth/__tests__/cognitoSdk.guardrail.test.ts`.
- `client/features/auth/components/__tests__/authRenderChurn.test.tsx` asserts
  card-shell render stability per form — it must keep passing (it is the
  behavioral guard for this refactor).
- Public props of the five forms must not change;
  `client/features/auth/components/AuthScreen.tsx` renders all five
  embedded, and the showcase gallery reaches them via the lazy barrel.
- `client/blocks/sign-in-form/Block.tsx` (207 LOC) is a deliberately
  independent showcase copy (its header comment says so) — do not touch it.

## Work
1. Create `client/features/auth/components/AuthFormCard.tsx`: the shared
   shell (embedded/standalone keyboard+scroll wrapper, logo, Card,
   CardHeader title/description, error banner, children slot). Derive its
   API from the intersection of the five forms' current shells.
2. Create `client/features/auth/components/validators.ts` exporting
   `validateEmail`, `validatePassword(minLength)`,
   `validateConfirmPassword`, `getSocialLabel`; delete the copies.
3. Create a shared style module for the common stylesheet keys; each form
   keeps only its unique styles.
4. Refactor the five forms onto the shell/validators/styles. Do not export
   the new internals from `components/index.ts` unless a consumer outside
   the folder needs them (none should).
5. VerifyEmailForm: remove the `title` default so the i18n fallback works;
   align the description fallback to `??`.

## Validation
- `bunx jest client/features/auth` — all suites green, especially
  `authRenderChurn` and `authComponentsSplitPoint`.
- `bun run typecheck && bun run lint && bun run check:features`
- `bun run build && bun run start`, then load `/auth-demo` and the showcase
  auth section on web: all five forms render with logo/title/error states;
  switch device language or force `es` to confirm the verify-email title now
  translates.
- `bun run bundle-size` against a fresh `bun run build` stays within budget
  (the auth chunk should shrink slightly).

## Out of scope
- `AuthScreen.tsx` internals (separate spec `auth-prune-dead-code`).
- Translating AuthScreen's hardcoded English error-copy mappings to i18n
  keys — worthwhile but behavior-adjacent; propose separately if wanted.
- `client/blocks/sign-in-form/`.

## Merge plan
Same feature as `auth-prune-dead-code` but different files (that spec touches
`AuthScreen.tsx`, `provider/cognitoClient.ts`, the feature barrel; this one
touches the five forms + new shared modules). Land this one first; rebase is
line-local at worst.
