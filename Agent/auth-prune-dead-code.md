---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Prune dead auth code and AuthScreen cruft

## Goal
Delete dead auth modules and hand-rolled indirection that no longer earns its
keep, and fix a real guard bug in the pricing demo. No behavior change except
the bug fix.

## Context
- `client/features/auth/index.ts` (33 LOC): feature-wide barrel with ZERO
  importers (verified — all consumers deep-import `stores/authStore`,
  `hooks/useAuth`, `provider`, or lazy-import `components`). Its own doc
  comment warns that importing it would undo the lazy split point by
  statically re-exporting the component graph. Dead code that is also a
  footgun.
- `client/features/auth/components/AuthScreen.tsx` (596 LOC) internal cruft:
  - `useAuthScreenContent` (defined line ~91, sole call site line ~88) is a
    hook that returns JSX and is called exactly once, immediately — collapse
    it into the component.
  - A `useReducer` (line ~100) with a single `"stateChanged"` action plus
    nine one-line setter wrappers re-implements a merge `setState` — replace
    with one `useState` + merge updater (or individual setters), whichever
    reads cleaner.
  - `resendVerificationCode` logs `JSON.stringify` of a value
    that is always `undefined` (`resendCode` returns void); there are ~15
    bare `console.log`s in the file despite `logDev` existing in
    `client/lib/devtools` — remove the useless log, route the rest through
    `logDev`.
- `client/features/auth/provider/cognitoClient.ts` lines ~65–80: the
  missing-env-var branch in `configure()` is unreachable — `getAuthClient`
  in `provider/index.ts` only constructs the Cognito client after
  `getAuthProvider()` has already verified both env vars. Remove the branch
  (keep a one-line invariant comment or `invariant()` if preferred).
- Bug (verified): `client/templates/pricing/demo.tsx:99` reads
  `if (!isAuthEnabled)` — `isAuthEnabled` is a FUNCTION
  (`client/features/app/isAuthEnabled.ts`), so the negation is always false
  and the "Sign-in is not configured in this environment" branch never runs.
  Must be `if (!isAuthEnabled())`.

Constraints that MUST hold (guardrail tests):
- `cognitoSdk.ts` stays the only Amplify entry
  (`cognitoSdk.guardrail.test.ts`).
- `clerkClient.ts` stays the only Clerk entry, reached via one specifier
  (`client/features/auth/components/__tests__/authComponentsSplitPoint.test.ts`
  also checks consumer specifiers).
- Do NOT delete or fold `AuthWrapper` / `AuthGate` into each other: the
  duplication is deliberate — `AuthGate`
  (`client/features/app/AuthGate.tsx`) lives in the eager graph and must not
  import the lazy auth chunk, while `AuthWrapper` is the public component
  demoed throughout `app/(main)/(demos)/auth-demo.tsx`.

## Work
1. Delete `client/features/auth/index.ts`. Confirm nothing imports
   `@/client/features/auth` bare (grep; the only current match is a path
   substring inside `client/features/i18n/__tests__/translationKeys.test.ts`,
   which does not import the barrel).
2. AuthScreen cleanup per Context: collapse `useAuthScreenContent`, replace
   the one-action reducer + nine setters, fix logging.
3. Remove the unreachable env branch in `cognitoClient.configure()`.
4. Fix `client/templates/pricing/demo.tsx:99` to call `isAuthEnabled()`.
5. If templates changed shape, run `bun run gen:templates:check` (the
   registry embeds template metadata, not source, so it should be a no-op).

## Validation
- `bunx jest client/features/auth client/templates scripts` — green,
  including both split-point guardrail suites and `authRenderChurn`.
- `bun run typecheck && bun run lint && bun run check:features`
- `bun run build && bun run start`: sign-in flow on `/auth-demo` still
  renders through loading → auth screen; with a blank `.env` (auth
  disabled), the pricing demo's upgrade button now shows the
  "Sign-in is not configured" notice instead of proceeding.
- `bun run docs:llms:check` (llms-examples walks demo/screen files).

## Out of scope
- The five form components and shared scaffolding
  (`auth-form-shell-consolidation`).
- `authStore` init-throttle rework (behavior-bearing), provider-selection
  dedupe across client/server (defensible as-is), `clerkClient` load-poll.

## Merge plan
Land after `auth-form-shell-consolidation` (same feature, different files;
rebase is line-local at worst).
