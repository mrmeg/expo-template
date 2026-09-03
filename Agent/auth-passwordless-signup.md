---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Passwordless (password-optional) sign-up for the Cognito provider

## Goal

Complete the playbook §7 feature set (`~/Development/clerk-to-cognito-migration.md`):
sign-up becomes email-first with password optional. A user who signs up without a
password is confirmed by email code and thereafter signs in with email codes
(`signInWithEmailCode`, shipped in PR #79). Password sign-up stays available
behind a toggle, mirroring the code-first sign-in layout PR #79 introduced.

## Context

Verified against the installed `@aws-amplify/auth` (aws-amplify ^6.20.0) types
and dev (PR #79 merged):

- `AuthSignUpInput.password?: string` — Amplify's `signUp` password is already
  optional (`node_modules/@aws-amplify/auth/dist/esm/types/inputs.d.ts:102`).
  The playbook's "verify password-optional signUp" holds at the SDK level.
- `SignUpOptions.autoSignIn?: SignInOptions | boolean`
  (`.../providers/cognito/types/options.d.ts:35`) — so passwordless sign-up can
  request auto sign-in with `{ authFlowType: "USER_AUTH" }`, which is how a
  just-confirmed passwordless user gets a session without a password.
- Sign-up next steps are `CONFIRM_SIGN_UP | COMPLETE_AUTO_SIGN_IN | DONE`
  (`.../types/models.d.ts:231`).
- `client/features/auth/provider/cognitoClient.ts` (PR #79 branch): `signUp`
  requires `password` and passes `autoSignIn: true`; `confirmSignUp` already
  calls `autoSignIn()` opportunistically and falls back to
  `{ status: "complete", autoSignedIn: false }`.
- `client/features/auth/provider/types.ts`: `signUp(params: { email; password })`.
- `client/features/auth/components/SignUpForm.tsx`: password + confirm-password
  are required fields; client-side validation is length ≥ 8 only.
  `SignInForm.tsx` on the PR branch shows the pattern to mirror: code-first
  layout active only when the new optional callback prop is passed, so
  existing consumers (showcase, blocks) keep the old layout and compile
  unchanged. Do NOT modify `client/blocks/sign-in-form/Block.tsx`.
- `AuthScreen.tsx` (PR branch) has views
  `sign-in | sign-up | forgot-password | verify-email | reset-password |
  confirm-sign-in-code`; `useAuth.ts` exposes `signInWithEmailCode` /
  `confirmSignInCode`.
- Pool prerequisite: sign-up without a password needs the pool to allow
  non-password first factors — `scripts/create-cognito-pool.sh` (PR #79)
  already creates `SignInPolicy.AllowedFirstAuthFactors=[PASSWORD,EMAIL_OTP]`.
  On a password-only pool, Cognito rejects passwordless `signUp` at runtime;
  map that to a surfaced `AuthError`, no env gating (same posture as
  email-code sign-in, which is also pool-dependent and ungated).
- Amplify keeps sign-up/auto-sign-in state in memory; if `autoSignIn()` fails
  after confirmation (e.g. app restarted mid-flow), the passwordless fallback
  is the existing email-code sign-in path — do not invent a new recovery flow.
- i18n strings live in `client/features/i18n/translations/en.ts` / `es.ts`.

## Work

1. **`types.ts`** — `signUp(params: { email: string; password?: string })`.
   Document: omitted password = passwordless account, confirmation code
   completes sign-up, sessions come from email-code sign-in thereafter.

2. **`cognitoClient.ts`**:
   - `signUp`: when `password` is present, current behavior unchanged. When
     absent, call `signUp({ username: email, options: { userAttributes:
     { email }, autoSignIn: { authFlowType: "USER_AUTH" } } })`.
   - `confirmSignUp`: unchanged control flow (it already tries `autoSignIn()`).
     Verify the `COMPLETE_AUTO_SIGN_IN` step also works for the USER_AUTH
     variant; if auto sign-in throws for a passwordless user, keep returning
     `{ status: "complete", autoSignedIn: false }` — the UI then routes to
     email-code sign-in instead of the password screen.
   - Map Cognito's rejection of passwordless sign-up on a non-EMAIL_OTP pool
     to `AuthError("unsupported", …)` with a message naming the pool
     requirement.

3. **`clerkClient.ts`** — `signUp` without `password` throws
   `AuthError("unsupported", …)`; with password, unchanged.

4. **UI** (`SignUpForm.tsx`, `AuthScreen.tsx`, translations):
   - `SignUpForm` gains an optional `onPasswordlessSignUp?: (email) => void`
     prop; when passed, default layout is email-only with primary action
     sign-up-without-password and an "Add a password" toggle revealing the
     existing password + confirm fields. Prop absent → current layout (keeps
     showcase/blocks unchanged).
   - `AuthScreen` passes the new prop; the existing `verify-email` view
     handles the confirmation code for both variants. After a passwordless
     confirmation where `autoSignedIn` is false, route to the
     `confirm-sign-in-code` path by calling `signInWithEmailCode` with the
     known email (not to the password sign-in view).
   - New `auth.*` strings in `en.ts` + `es.ts` (e.g. `auth.addAPassword`,
     `auth.signUpWithoutPassword`).

5. **Docs/env**: extend the sign-in methods note in `README.md` and the
   `.env.example` Cognito comment to mention password-optional sign-up and its
   pool requirement. `scripts/create-cognito-pool.sh` needs no changes.

6. **Tests** (extend the PR #79 suites in place):
   - `cognitoClient`: passwordless signUp sends no password + USER_AUTH
     autoSignIn options; password signUp regression; unsupported-pool error
     mapping.
   - `clerkClient`: passwordless signUp → `unsupported`.
   - `SignUpForm`: email-only default when the prop is passed, password
     toggle restores current behavior, untouched layout without the prop.
   - `AuthScreen`: passwordless sign-up → verify-email → (autoSignedIn false)
     → email-code sign-in route.

## Validation

- `bun run typecheck` && `bun run lint`
- `bunx jest --watchAll=false client/features/auth`
- `bun run check:features`
- `node scripts/check-bundle-size.js` after `bun run build` (Amplify stays out
  of the eager bundle — single-entry constraint in `cognitoSdk.ts`).
- Live (HITL, against the `expo-template` pool once it exists): passwordless
  sign-up → email code → session; password sign-up regression; app-restart
  between confirm and auto sign-in falls back to email-code sign-in cleanly.

## Out of scope

- Passkeys / `WEB_AUTHN`, SMS OTP.
- Removing the password path or changing password validation rules.
- Clerk feature work beyond the `unsupported` stub.
- Pool changes (the PR #79 script already enables EMAIL_OTP).

## Open questions

None. SDK optionality, autoSignIn option shape, and sign-up step literals were
verified against the installed `@aws-amplify/auth` type definitions.
