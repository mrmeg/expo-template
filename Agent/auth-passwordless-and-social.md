---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Email-code (passwordless) and social sign-in for the pluggable auth layer

## Goal

Password-only auth is the template's weakest UX. Add two sign-in methods to the
Cognito provider, keeping password available:

1. **Email one-time code** — Cognito choice-based auth (`USER_AUTH` flow,
   `EMAIL_OTP` challenge). No custom Lambdas.
2. **Social sign-in (Google + Apple)** — Amplify `signInWithRedirect` through a
   Cognito Managed Login domain.

This is Phase 0 of the Clerk→Cognito migration plan
(`/Users/mattmegenhardt/Development/clerk-to-cognito-migration.md` §7): every app
migrates by copying this template, so the features land here first.

## Context

Verified current behavior:

- `client/features/auth/provider/types.ts` — `AuthClient` covers only password
  flows (`signIn`/`signUp`/`confirmSignUp`/`resendCode`/`forgotPassword`/
  `resetPassword`/`signOut`) plus `init`/`getCurrentUser`/`getToken`/
  `onAuthChange`. Normalized `AuthError` with `AuthErrorCode` union;
  `AuthFlowResult` is `"complete" | "needsConfirmation"`.
- `client/features/auth/provider/cognitoClient.ts` — Amplify impl. Its Hub
  listener already maps `signInWithRedirect` → `signedIn` and
  `signInWithRedirect_failure` → `sessionExpired`, so OAuth *event* plumbing
  exists; nothing can *trigger* a redirect. `Amplify.configure` sets only
  `userPoolId`/`userPoolClientId` (no `loginWith.oauth` block).
- `client/features/auth/provider/cognitoSdk.ts` — the **single lazy Amplify
  entry point**. Load-bearing bundle constraint documented in its header: new
  Amplify APIs must be re-exported from this module, never imported via a
  second `import("aws-amplify/…")` elsewhere, or the Amplify cluster (~103 kB
  gzip) leaks into the eager web bundle.
- `client/features/auth/components/SignInForm.tsx` and `SignUpForm.tsx` already
  accept `socialProviders` + `onSocialSignIn` props and render provider
  buttons — but `AuthScreen.tsx` passes `socialProviders={[]}` and no handler.
  UI shells exist; wiring is absent.
- `client/features/auth/components/VerifyEmailForm.tsx` — reusable code-entry
  form (used for sign-up confirmation); suitable for OTP entry.
- `client/features/auth/components/AuthScreen.tsx` — state machine over views
  `sign-in | sign-up | forgot-password | verify-email | reset-password` with a
  merge-updater; all transitions local to the component.
- `client/features/auth/hooks/useAuth.ts` — thin wrapper mapping `AuthClient`
  methods; re-initializes the store on completed sign-in via
  `requireAuthClient()` + `initialize()`.
- `client/features/auth/provider/clerkClient.ts` — Clerk impl of the same
  interface. Migration plan: apps are leaving Clerk; parity for the new
  methods is NOT required (see Work item 6).
- `app.config.ts` — app scheme comes from `getAppIdentity()` and is surfaced at
  runtime as `Constants.expoConfig.extra.appScheme`.
- Deps: `aws-amplify@^6.20.0` (USER_AUTH/EMAIL_OTP supported since 6.9),
  `@aws-amplify/react-native@^1.3.3`, `expo-web-browser@~57.0.2`.
  `@aws-amplify/rtn-web-browser` is NOT installed — Amplify requires it for
  `signInWithRedirect` on native (web needs nothing extra).
- `.env.example` lines 42–46 hold the auth vars
  (`EXPO_PUBLIC_AUTH_PROVIDER`, Clerk keys, `EXPO_PUBLIC_USER_POOL_ID`,
  `EXPO_PUBLIC_USER_POOL_CLIENT_ID`). No Cognito domain var exists.
- i18n: user-facing strings live in
  `client/features/i18n/translations/en.ts` / `es.ts` (`auth.*` keys).
- No pool-creation script exists in this repo (camera-app has
  `scripts/create-cognito-pool.sh`; the migration playbook §2/§7 defines the
  canonical settings).
- Server: no changes anywhere. Email-OTP and social sign-ins yield the same
  Cognito JWTs; `server/api/shared/cognitoTokenVerifier.ts` already covers
  them.

Cognito prerequisites (AWS-side, not part of this implementation; §7 of the
playbook): Essentials-tier pool with
`SignInPolicy={AllowedFirstAuthFactors=[PASSWORD,EMAIL_OTP]}`, client with
`ALLOW_USER_AUTH`, SES email config, Managed Login domain, Google/Apple IdPs,
callback URLs for the app scheme and web origins.

## Work

1. **`types.ts` — extend the contract** (keep it provider-agnostic):
   - `signInWithEmailCode(params: { email: string }): Promise<AuthFlowResult>`
     — `needsConfirmation` means "code sent, collect it".
   - `confirmSignInCode(params: { code: string }): Promise<{ status: "complete" }>`
     — continues the in-flight sign-in; no email param (Amplify's
     `confirmSignIn` operates on internal state).
   - `signInWithProvider(provider: "google" | "apple"): Promise<void>` —
     resolves when the redirect is launched; session arrival is reported
     through the existing `onAuthChange` events.
   - Add `"unsupported"` to `AuthErrorCode`.

2. **`cognitoSdk.ts`** — re-export `confirmSignIn` and `signInWithRedirect`
   with the auth namespace (they're part of `aws-amplify/auth`, so the
   existing `* as amplifyAuth` already carries them — verify and update the
   doc-comment API list). Respect the single-entry constraint.

3. **`cognitoClient.ts`**:
   - `signInWithEmailCode`: `signIn({ username: email, options: {
     authFlowType: "USER_AUTH", preferredChallenge: "EMAIL_OTP" } })`; map
     `nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE"` (literal
     confirmed in installed `@aws-amplify/auth` types) →
     `needsConfirmation`; `isSignedIn` → `complete`.
   - `confirmSignInCode`: `confirmSignIn({ challengeResponse: code })`;
     non-signed-in result → `AuthError("codeMismatch" | "unknown", …)`.
   - `signInWithProvider`: `signInWithRedirect({ provider })` mapping
     `"google" → "Google"`, `"apple" → "Apple"` (Amplify's `AuthProvider`
     union is capitalized; confirmed in installed types). Requires the oauth
     config below; when `EXPO_PUBLIC_COGNITO_DOMAIN` is unset, throw
     `AuthError("unsupported", …)`.
   - `configure()`: when `EXPO_PUBLIC_COGNITO_DOMAIN` is set, add
     `loginWith: { oauth: { domain, scopes: ["openid","email","profile"],
     responseType: "code", redirectSignIn, redirectSignOut } }` — redirect
     URLs built from `Constants.expoConfig.extra.appScheme` (`<scheme>://`)
     on native and `window.location.origin` on web.
   - Add `@aws-amplify/rtn-web-browser` (dev-build requirement; note in the
     spec'd README/env comments that social sign-in on native needs a dev
     build, not Expo Go).

4. **`useAuth.ts`** — expose `signInWithEmailCode`, `confirmSignInCode`
   (re-`initialize()` on complete), `signInWithProvider`.

5. **UI — email-first sign-in, social wired** (`AuthScreen.tsx`,
   `SignInForm.tsx`, translations):
   - `SignInForm` gains an email-code path: with only email filled, primary
     action "Email me a code" (`onEmailCodeSignIn`); "Use password instead"
     toggle reveals the password field + existing behavior. Default to the
     code-first layout.
   - New `AuthScreen` view `"confirm-sign-in-code"` reusing `VerifyEmailForm`
     (email + code entry, resend = re-call `signInWithEmailCode`); on
     success → `onAuthenticated`.
   - Social buttons: derive enabled providers from new env
     `EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS` (comma list, e.g. `"google,apple"`,
     empty = hidden); pass to `SignInForm`/`SignUpForm` `socialProviders` and
     wire `onSocialSignIn` → `signInWithProvider`. Sign-in completion arrives
     via the existing Hub → `onAuthChange` → store path; `AuthScreen` should
     surface a loading state while the redirect is in flight and an error on
     `sessionExpired` following a redirect failure.
   - Drop `"github"` from the `socialProviders` union (no Cognito IdP for it
     is planned) or leave the type but never enable it — implementer's call;
     keep the diff minimal.
   - New strings in `en.ts` + `es.ts` (`auth.emailMeACode`,
     `auth.usePasswordInstead`, `auth.checkEmailForCode`, etc.).
6. **`clerkClient.ts`** — implement the three new methods as
   `throw new AuthError("unsupported", "…")`. No Clerk feature work.

7. **Env + scripts + docs**:
   - `.env.example`: add `EXPO_PUBLIC_COGNITO_DOMAIN=""` and
     `EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS=""` with comments explaining the
     AWS-side prerequisites (playbook §7).
   - Add `scripts/create-cognito-pool.sh`: camera-app's script extended per
     playbook §7 — `--user-pool-tier ESSENTIALS`, sign-in policy with
     `EMAIL_OTP`, `ALLOW_USER_AUTH` on the client, optional SES
     `--email-configuration`, `create-user-pool-domain
     --managed-login-version 2`, commented `create-identity-provider`
     stanzas for Google/Apple (credentials supplied by the operator), client
     `SupportedIdentityProviders`/callback URLs. Header note: runnable
     locally with a Cognito-capable profile or pasted into CloudShell.
   - Update the auth section of the template docs/README that documents
     provider env selection (wherever `.env.example` comments point).

8. **Tests** (extend existing suites next to what they cover):
   - `cognitoClient` unit tests with mocked `cognitoSdk`: email-code happy
     path (`needsConfirmation` → `complete`), code mismatch mapping,
     `signInWithProvider` without domain → `unsupported`, oauth config
     presence when domain set.
   - `clerkClient` new methods throw `unsupported`.
   - `SignInForm` renders code-first layout, password toggle, social buttons
     from props; `AuthScreen` transition sign-in → confirm-sign-in-code.

## Validation

- `bun run typecheck` && `bun run lint`
- `bunx jest --watchAll=false client/features/auth server/api/shared`
- `bun run check:features` (feature-isolation guard)
- Web bundle guard: `node scripts/check-bundle-size.js` — the Amplify cluster
  must stay out of the eager bundle (cognitoSdk single-entry constraint).
- Live checks (HITL, needs a §7-configured pool; defer if IdP creds absent —
  note in PR): real email-OTP sign-in with SES delivery on the iOS simulator;
  Google and Apple redirect round-trips; password sign-in regression.

## Out of scope

- Passwordless **sign-up** (password-optional `signUp`) — follow-up spec once
  email-code sign-in is proven; sign-up keeps collecting a password.
- Passkeys / `WEB_AUTHN` (stretch in playbook §7; RN support unverified).
- SMS OTP, GitHub or other IdPs, custom Managed Login branding.
- Any server change; any Clerk feature work beyond `unsupported` stubs.
- AWS-side execution (pool updates, IdP registration) — tracked in the
  migration playbook, performed via CloudShell/console by the operator.

## Open questions

None. The two SDK literals (email-OTP `signInStep`, `AuthProvider` casing)
were verified against the installed `@aws-amplify/auth` type definitions.
