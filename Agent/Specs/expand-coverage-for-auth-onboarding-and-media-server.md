# Spec: Expand Coverage for Auth, Onboarding, and Media Server Paths

**Status:** Ready
**Priority:** Medium
**Scope:** Server + Client

---

## What
Add automated coverage for the auth bootstrap path, onboarding shell behavior, and the media server regressions uncovered in investigation. The test setup should include the relevant `app/api/**` and `server/**` logic, not only `client/**`, so CI can catch route-contract drift and startup regressions before they ship.

## Why
The current Jest suite is concentrated on UI primitives, small hooks, utility helpers, and a few stores. High-risk behavior in auth initialization, onboarding gating, shared CORS handling, upload limiter wiring, and FFmpeg worker serving currently has no automated backstop, and the coverage report does not even target `app/api/**` or `server/**`.

## Current State
- `jest.config.js` only collects coverage from `client/**/*.{ts,tsx}`.
- There are no tests under `app/api/` or `server/`.
- There are no tests for `client/features/auth/**` bootstrap behavior or for onboarding’s integration with the real shell.
- Existing tests live mainly under `client/components/ui/__tests__`, `client/hooks/__tests__`, `client/lib/api/__tests__`, and `client/state/__tests__`.
- `test/setup.ts` already mocks key Expo modules, but it does not yet provide a deliberate harness for API-route or server bootstrap verification.

## Changes
### 1. Expand the coverage target to the real risk areas
Files:
- `jest.config.js`

Update coverage collection so the report includes the auth and onboarding integration points plus selected server-side code, for example:
- `client/features/auth/**`
- `client/features/onboarding/**`
- `app/api/**`
- `server/**`

If one Jest config cannot reasonably cover both client and server paths, introduce a narrowly scoped supplemental config or test command rather than leaving those areas unmeasured.

### 2. Add focused regression tests for media server contracts
Files:
- `app/api/_shared/**/__tests__/*`
- `app/api/media/**/__tests__/*`
- `server/**/__tests__/*`

Cover the concrete failures already found:
- shared CORS helper advertises `DELETE`
- strict limiter is attached to `/api/media/getUploadUrl`
- FFmpeg worker route/path wiring remains valid

If `server/index.ts` is too side-effectful to test directly, extract app creation or route registration into a helper that can be imported without opening a listening socket.

### 3. Add startup tests for auth and onboarding behavior
Files:
- `client/features/auth/**/__tests__/*`
- `client/features/onboarding/**/__tests__/*`
- `app/**/__tests__/*` or extracted shell gate component tests

Add tests for:
- auth bootstrap without duplicate initialization
- auth-disabled development behavior when env vars are missing
- onboarding first-run versus repeat-launch behavior
- shell gating logic once onboarding and auth become real app-entry concerns

### 4. Extend the shared test harness only as needed
Files:
- `test/setup.ts`
- test utilities under `test/**`

Add minimal helpers and mocks for route handlers, server wiring, and auth bootstrap. Keep the harness deterministic and network-free; external AWS, Cognito, and S3 calls should remain mocked.

## Acceptance Criteria
1. CI exercises tests that cover auth bootstrap, onboarding gating, and the investigated media server regressions.
2. Coverage reporting includes the newly targeted auth/onboarding and server-side files, either in the main Jest config or in a documented companion test config.
3. There is a regression test or equivalent assertion for each of these issues:
   - missing `DELETE` in shared CORS methods
   - strict limiter mounted on the wrong upload route
   - broken FFmpeg worker path/serving assumptions
4. The new tests do not require live network access, live Cognito configuration, or live S3/R2 credentials.
5. Test runtime remains reasonable for local use and CI.

## Constraints
- Do not introduce tests that depend on real AWS services or external CDNs.
- Keep mocks and helpers narrowly scoped so the suite stays maintainable.
- Avoid opening a real server port during unit tests unless there is no smaller viable seam.
- Preserve the existing Expo-oriented test environment for client code.
- Prefer extracting testable seams over asserting against opaque side effects.

## Out of Scope
- Full browser E2E coverage
- Native device automation
- Snapshot testing of every screen
- Exhaustive coverage targets for the entire repository
- Performance benchmarking or load testing

## Files Likely Affected
### Server
- `server/index.ts`
- `server/**/__tests__/*`
- `app/api/_shared/cors.ts`
- `app/api/media/**`

### Client
- `client/features/auth/**`
- `client/features/onboarding/**`
- extracted shell gate components under `client/**` or `app/**`
- `test/setup.ts`

### Tooling
- `jest.config.js`
- `package.json` if an additional targeted test command is introduced

## Edge Cases
- Auth env vars are missing and bootstrap should still be testable in development mode.
- Server tests need to verify route wiring without binding a real port.
- Shared CORS behavior differs when the request has no `Origin` header versus a disallowed one.
- Coverage expansion should not accidentally include generated build artifacts or `dist/`.

## Risks
- These tests may require small refactors to isolate bootstrapping and server wiring from side effects. That is acceptable if the refactors stay narrow and improve long-term testability rather than introducing a second architecture.

## Dependency / Ordering Notes
- This spec depends on the three media-server fixes (`fix-media-delete-cors-for-web`, `align-media-upload-rate-limiting`, `restore-web-ffmpeg-worker-serving`) and on `wire-app-shell-to-auth-and-onboarding-flows`. Do not run this spec until those have landed, or the tests will either assert the current broken state (meaningless) or assert a future state that does not yet exist. If only some of the prerequisite specs are merged, scope the test additions to the ones that are.
- `server/index.ts` is CommonJS (`const x = require(...)`) and the default `jest-expo` preset runs in a JSDOM-like environment. Server-side tests should opt into a Node test environment via `@jest-environment node` pragma or a supplemental Jest projects config. The test harness should not spin up a listening socket; extract app creation into an exported factory if needed.
- Coverage reporting changes in this spec are limited to `collectCoverageFrom`. Coverage **thresholds** (currently commented out in `jest.config.js:41-48`) remain out of scope unless a separate decision is made to enforce them.
- If `server/**` unit tests require different transforms than `jest-expo` provides, prefer introducing a Jest `projects` array (one Expo project for client, one Node project for server) over rewriting the existing client test setup.
