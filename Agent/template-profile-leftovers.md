---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Template app: remove profile placeholders, enable haptics

## Goal

The Profile tab stops shipping "coming soon" toasts and a fake email, so forks
inherit working behavior; the template turns on the kit's haptics where it demos
primary actions.

## Context

- `app/(main)/(tabs)/profile.tsx`: `user?.email || "user@example.com"` (line 130);
  six `showInfoMessage("… coming soon")` handlers (lines 422-457: edit profile,
  change password, privacy settings, Google/Apple linking, account deletion);
  notification switches are `useState` mocks (lines 64-66).
- Auth: `client/features/auth/provider/types.ts` `AuthClient` has `signOut`,
  `forgotPassword(email)`, `resetPassword`, `signInWithProvider(name)`
  (rejects `unsupported`), no update-profile or delete. `AuthGate` renders the
  children unchanged when auth is disabled (`client/features/app/AuthGate.tsx:45`),
  so the profile screen must make sense with no session.
- Social providers are env-gated (`EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS`, see
  README Auth); Cognito is the only provider with password flows.
- Matt's unpushed `stack/07-forkability` branch changes one line of this file
  (`handleUpgrade` → `/(main)/billing`): leave that function untouched.
- Haptics setting comes from the press-feedback spec (`UIProvider haptics`);
  `RootLayout.tsx:164` mounts the provider. `hapticSuccess` exists in
  `@mrmeg/expo-ui/lib`.

## Work

1. `client/features/profile/profileStore.ts` (zustand, persisted like the
   onboarding store): `displayName`, `publicProfile`, `analytics`,
   `emailNotifications`, `pushNotifications`, `marketingEmails`. Profile header
   shows `displayName || user?.username || "Your profile"`; the email line
   renders only when `user?.email` exists.
2. Edit Profile → `BottomSheet` with a `TextInput` for display name and Save
   (`hapticSuccess` + success toast). Local-only; the sheet copy says so when
   auth is disabled.
3. Change Password → shown only when the active provider supports password
   reset and `user.email` exists: calls `forgotPassword(email)` and routes into
   the existing reset step of the auth screen (see `AuthScreen.tsx` reset flow);
   otherwise the row is hidden.
4. Privacy Settings → `Collapsible` row revealing two `Switch`es bound to the
   store (public profile, analytics).
5. Connected Accounts → section hidden unless social providers are configured;
   when configured, "Connect" calls `signInWithProvider` and errors surface as
   toasts. No fake "Not connected" copy without a provider.
6. Delete Account → optional `deleteAccount?(): Promise<void>` on `AuthClient`,
   implemented for Cognito (`deleteUser` from `aws-amplify/auth`) and Clerk
   (`user.delete()`); the confirm dialog calls it, then signs out. If a provider
   cannot implement it cleanly, leave `deleteAccount` undefined there; when the
   client lacks it, the row is hidden.
7. Notification switches bind to the store; `RootLayout` `UIProvider haptics="all"`.
8. Tests first: `profileStore` persistence; profile screen renders no
   `example.com` and no "coming soon" text (RNTL, auth disabled and
   authenticated mocks); Cognito `deleteAccount` calls the SDK
   (`provider/__tests__/cognitoClient.test.ts`); hidden rows when unsupported.

## Validation

- `bun run test:ci -- --maxWorkers=2 client app`, `bun run typecheck`, `bun run lint`,
  `bun lint:ui --changed`, `bun run check:features` (auth remains an isolated
  feature: new files that import auth stay under `client/features/`), `bun run verify`.
- Web `/profile` light/dark before/after under `/tmp/fleet/ui/expo-ui/profile/`
  with a blank `.env`.

## Merge plan

Conflict-prone with `stack/07-forkability` (one line in `profile.tsx`). Keep
`handleUpgrade` verbatim; if `stack/07` lands first, rebase before merging.

## Out of scope

A backend for profile edits; billing rows; the Settings tab.

## Open questions

None.
