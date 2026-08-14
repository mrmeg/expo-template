---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/66
---

# Collapse Amplify into a single lazy chunk on web

## Goal
Remove ~124 KB raw (~30 KB gzip) of AWS Amplify code from the eagerly loaded web `__common` chunk. Today every web user — including Clerk-only deploys that never touch Cognito — downloads `@aws-amplify/core` (87.6 KB) and `@aws-amplify/auth` (36 KB) before first render.

## Context
- Metro hoists any module shared by 2+ async chunks into the eager `__common` bundle. A dependency stays lazy only when it has exactly one split point (multiple `import()`s of the *same* resolved module are fine — they form one chunk).
- `client/features/auth/provider/cognitoClient.ts` violates this with three different dynamic import specifiers: `import("aws-amplify")` (line 76), `import("aws-amplify/utils")` (line 88), and `import("aws-amplify/auth")` (line 111). The three entry points share Amplify internals, so those internals hoist into `__common`.
- The fix pattern is already documented and proven in this repo: see the doc comment in `client/features/auth/provider/AuthProviderGate.tsx`, which explains how the `clerkClient.ts` indirection keeps the Clerk cluster in one lazy chunk.
- Measured on the 2026-08-13 `bun run build-web` output: `__common` is 1,111,255 B raw / 287,541 B gzip, containing 87.6 KB `@aws-amplify/core` + 36 KB `@aws-amplify/auth`.

## Work
1. Create `client/features/auth/provider/cognitoSdk.ts` that statically imports everything Amplify-related the client needs and re-exports it:
   - `Amplify` from `aws-amplify`
   - `Hub` from `aws-amplify/utils`
   - `import * as amplifyAuth from "aws-amplify/auth"` (covers `getCurrentUser`, `fetchAuthSession`, `signIn`, `signUp`, `confirmSignUp`, `autoSignIn`, `resendSignUpCode`, `resetPassword`, `confirmResetPassword`, `signOut`)
2. In `cognitoClient.ts`, replace all three runtime `import("aws-amplify…")` calls with `import("./cognitoSdk")` — the identical specifier every time. The `auth()` helper returns the `amplifyAuth` namespace; the type alias `AmplifyAuthModule` can stay a type-only `typeof import("aws-amplify/auth")` (erased at runtime).
3. Tests: `client/features/auth/__tests__/provider.test.ts` deliberately never exercises the dynamic-import happy paths (see its scope note), so no mock updates are expected — just confirm the suite still passes.
4. Run `node scripts/check-bundle-size.js --update` and commit the new baseline.

## Validation
- `bun run typecheck`, `bun run test:ci` pass.
- After `bun run build-web`: no `@aws-amplify` sources remain in the `__common-*.js.map` sourcemap; a single new lazy chunk contains the Amplify cluster; `__common` shrinks by roughly 120 KB raw.
- Cognito flows still work when `EXPO_PUBLIC_USER_POOL_ID`/`EXPO_PUBLIC_USER_POOL_CLIENT_ID` are set (unit tests cover the client contract).

## Out of scope
- Auth form components in `__common` (separate spec: `web-auth-screen-lazy-chunk`).
- Native bundles (no `__common` concept there; inlineRequires already defers Amplify).

## Merge plan
`scripts/bundle-baseline.json` is also updated by `web-sentry-strip-web-replay` and `web-auth-screen-lazy-chunk`. If another of these merges first, sync with `dev` and re-run `node scripts/check-bundle-size.js --update` before merge.
