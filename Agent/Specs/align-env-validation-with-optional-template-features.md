# Spec: Align Env Validation With Optional Template Features

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What
Make startup environment validation match the template contract: a fresh clone should be explorable without Cognito, API, billing, or storage credentials. Validation should still catch partial or contradictory configuration that would break an enabled feature.

## Why
The repo is intended to reduce repeated app setup. If the default `.env.example` values trigger "required" warnings for optional template features, adopters cannot tell which setup steps are actually mandatory.

## Current State
`client/lib/validateEnv.ts` marks `EXPO_PUBLIC_USER_POOL_ID`, `EXPO_PUBLIC_USER_POOL_CLIENT_ID`, and `EXPO_PUBLIC_API_URL` as required client env vars. `app/_layout.tsx` calls `validateClientEnv()` at module load. Agent docs state auth is optional and the template is fully explorable without Cognito env vars.

## Changes
1. Replace blanket required client checks with feature-aware validation.
   - Treat blank Cognito env as auth disabled.
   - Warn when exactly one Cognito env var is present.
   - Treat blank `EXPO_PUBLIC_API_URL` as allowed when local Expo API routes are used.
   - Preserve the existing billing-enabled-without-app-url warning.

2. Add focused tests for validation behavior.
   - Cover blank default env with no warnings.
   - Cover partial Cognito config.
   - Cover billing enabled without `EXPO_PUBLIC_APP_URL`.
   - Cover any API URL rule that remains after the change.

3. Update docs to describe required versus optional env.
   - Refresh `.env.example` comments if needed.
   - Update `README.md` and Agent docs if they still imply auth/API setup is mandatory.

## Acceptance Criteria
1. A default `.env.example`-style configuration produces no "missing required client environment variables" warning.
2. Partial Cognito config still warns clearly.
3. Billing config warnings still work.
4. Existing app startup behavior remains unchanged for auth-disabled and auth-enabled paths.
5. `bun run typecheck` and the relevant Jest tests pass.

## Constraints
- Do not throw during route initialization.
- Do not make Cognito mandatory.
- Keep Expo public env reads as direct `process.env.EXPO_PUBLIC_*` property access so Expo can inline them.

## Out of Scope
- Building a full env schema system.
- Server-side storage validation changes beyond documentation drift found during implementation.
- Changing how auth itself is bootstrapped.

## Files Likely Affected
Client:
- `client/lib/validateEnv.ts`
- `app/_layout.tsx` only if the call site needs comment cleanup
- `client/features/app/isAuthEnabled.ts` only if shared logic is extracted

Tests:
- `client/lib/__tests__/validateEnv.test.ts` or nearby equivalent

Docs:
- `.env.example`
- `README.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/API.md`

## Edge Cases
- `EXPO_PUBLIC_USER_POOL_ID` set but client id blank should warn.
- Client id set but pool id blank should warn.
- Whitespace-only values should be treated as missing.
- Billing flag values `"true"` and `"1"` should both keep the existing app URL warning.

## Risks
Over-correcting validation could hide real misconfiguration. Mitigate by warning on partial feature config rather than warning on intentionally disabled features.
