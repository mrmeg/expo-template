---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/67
---

# Move auth screen/forms out of eager `__common` into one lazy chunk

## Goal
Remove ~57 KB raw (~15 KB gzip) of auth UI from the eagerly loaded web `__common` chunk. `SignUpForm` (9.9 KB), `ResetPasswordForm` (9.4 KB), `AuthScreen` (8.9 KB), `SignInForm` (8.4 KB), `VerifyEmailForm` (7.5 KB), `ForgotPasswordForm` (7.3 KB) currently ship before first render on every route, even for signed-in users who never see them.

## Context
- Metro hoists modules shared by 2+ async chunks into the eager `__common` bundle; a module stays lazy only behind a single split point. Multiple `import()`s pointing at the same resolved module still form one chunk (pattern documented in `client/features/auth/provider/AuthProviderGate.tsx`).
- The auth form graph is statically reachable from three route chunks today:
  - `app/(main)/(tabs)/profile.tsx` → `client/features/app/AuthGate.tsx` → `AuthScreen` (line 4/45) → all forms
  - `app/(main)/(demos)/auth-demo.tsx` → `AuthWrapper` (line 4) → `AuthScreen`
  - `app/(main)/(demos)/showcase/index.tsx` → direct imports of the five form components (lines 26–30)
- `profile.tsx`, `billing/return.tsx` also import `stores/authStore` and `hooks/useAuth` — those are small (~3.5 KB combined), hot, and should stay static/eager.
- Exported HTML is a static shell (SSR removed, PR #56), so a Suspense fallback during chunk load matches what the shell already shows.

## Work
1. Create a barrel `client/features/auth/components/index.ts` that statically re-exports `AuthScreen`, `AuthWrapper`, `SignInForm`, `SignUpForm`, `VerifyEmailForm`, `ForgotPasswordForm`, `ResetPasswordForm`. This barrel is the single split point; every dynamic import below must use the exact same specifier (pick one, e.g. `@/client/features/auth/components`) so Metro sees one resolved target.
2. `client/features/app/AuthGate.tsx`: replace the static `AuthScreen` import with `React.lazy` on the barrel; wrap in `Suspense` reusing the existing loading branch (themed `ActivityIndicator`) as fallback.
3. `app/(main)/(demos)/auth-demo.tsx`: same treatment for `AuthWrapper` (its own loading UI makes a plain fallback acceptable).
4. `app/(main)/(demos)/showcase/index.tsx`: same treatment for the five form components (a null or skeleton fallback is fine for gallery previews).
5. Keep `stores/authStore`, `hooks/useAuth`, and `provider/*` imports static — only the component graph moves behind the split point.
6. Update affected tests (RNTL 14: `render`/`fireEvent` are async; lazy components need `await`/`findBy*`). Known case: `client/features/app/__tests__/AuthGate.test.tsx` mocks `@/client/features/auth/components/AuthScreen` by exact path (line 43) — the mock must target whatever module the lazy import actually resolves (the new barrel), or the stub silently stops applying.
7. Run `node scripts/check-bundle-size.js --update` and commit the new baseline.

## Validation
- `bun run typecheck`, `bun run test:ci` pass.
- After `bun run build-web`: no `client/features/auth/components/*` sources in the `__common-*.js.map` sourcemap; the forms live in exactly one lazy chunk.
- Manual: signed-out profile tab on web shows the loading indicator briefly, then `AuthScreen`; showcase auth section still renders; auth-demo route works.

## Out of scope
- The Amplify SDK split (separate spec: `web-amplify-single-split-point`).
- Lazy-loading `client/showcase/` registry/previews (~27 KB in `__common`) — demo-only weight that disappears when forks delete `(demos)`.
- packages/ui overlay primitives (vaul/radix/floating-ui, ~150 KB in `__common`) — larger package-level change, not planned yet.

## Open questions
- None blocking. Accepted tradeoff: first signed-out render of the profile tab fetches one extra chunk (brief spinner), matching the existing Clerk provider gate behavior.

## Merge plan
`scripts/bundle-baseline.json` is also updated by `web-amplify-single-split-point` and `web-sentry-strip-web-replay`. If another of these merges first, sync with `dev` and re-run `node scripts/check-bundle-size.js --update` before merge.
