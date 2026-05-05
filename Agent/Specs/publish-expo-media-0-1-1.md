# Spec: Publish Expo Media 0.1.1

**Status:** Blocked
**Priority:** High
**Scope:** Server + Client

---

## What
Publish the committed `@mrmeg/expo-media@0.1.1` package to npm and make the publish path reliable for future package updates. The work should classify the current failure as registry authentication or trusted publishing friction unless package validation proves otherwise.

## Why
Consumer apps install `@mrmeg/expo-media` from npm, not this monorepo workspace. The repository currently advertises and commits version `0.1.1`, but npm still serves `0.1.0`, so consumers cannot receive the latest media package surface.

## Current State
`packages/media/package.json` declares version `0.1.1`. `npm view @mrmeg/expo-media version dist-tags --json` returned `0.1.0` as the latest published version during investigation.

`.github/workflows/publish-media.yml` has a `Publish Media Package` workflow with package gates, packed consumer smoke validation, npm trusted publishing, and optional `NPM_TOKEN` fallback. The two latest publish runs failed at `npm publish` with `ENEEDAUTH` after build, pack, and consumer smoke had already passed, which points to registry auth/trusted publishing rather than a package artifact failure.

## Changes
1. Verify the package artifact locally and in CI.
   - Run the existing package gates before attempting any publish:
     ```sh
     bun run media:typecheck
     bun run media:test
     bun run media:build
     bun run media:pack
     bun run media:consumer-smoke
     ```
   - Confirm `packages/media/package.json` and `bun.lock` agree on `0.1.1`.

2. Repair the publish credential path.
   - Inspect the failed `publish-media.yml` run logs and classify the blocker as either missing npm trusted publisher setup or missing/invalid `NPM_TOKEN`.
   - If trusted publishing is intended, configure npm package trusted publishing for owner `mrmeg`, repository `expo-template`, workflow filename `publish-media.yml`.
   - If trusted publishing is still unavailable and an `NPM_TOKEN` repository secret is already present, use the documented token fallback for this package and keep the workflow path intact.
   - If neither trusted publishing nor a usable token is available, stop with a credential blocker that names the missing setup. Do not keep rerunning the same failing publish job.

3. Publish and verify the registry.
   - Rerun the workflow manually with `version=0.1.1` and `ref=main` for the exact committed version instead of bumping again.
   - Watch the workflow to completion.
   - Verify with:
     ```sh
     npm view @mrmeg/expo-media version dist-tags --json
     ```
   - The result must report `0.1.1` as `latest`.

4. Update release documentation if the failure mode taught a new durable step.
   - Update `Agent/Docs/EXPO_MEDIA_PACKAGE.md` only if the publish workflow or setup instructions change.
   - Do not duplicate generic npm auth advice; keep the docs specific to this package workflow.

## Acceptance Criteria
1. `npm view @mrmeg/expo-media version --json` returns `"0.1.1"`.
2. The successful GitHub Actions run for `publish-media.yml` is linked or recorded in the shift report.
3. Package validation gates pass before the publish step in the successful run.
4. The final response or shift report clearly states whether trusted publishing or `NPM_TOKEN` was used.
5. No new version bump is committed unless `0.1.1` is already published by the time work begins.

## Constraints
- Do not bump to `0.1.2` just to work around the failed publish unless `0.1.1` has already reached npm.
- Do not publish from a local developer machine unless the workflow path is impossible and the human explicitly approves that fallback.
- Keep package validation focused on `packages/media`; do not run unrelated app builds unless a package gate points to an app-level problem.
- Treat `ENEEDAUTH`, `EOTP`, and related npm errors as auth/setup blockers unless artifact checks fail separately.
- Before any expensive local validation on macOS, take a fresh power reading with `pmset -g batt` and `pmset -g custom`; if unplugged or Low Power Mode is enabled, prefer the GitHub workflow gates or lower-cost checks.

## Out of Scope
- New media package features.
- UI package publishing.
- Consumer app adoption work beyond registry verification.
- Rewriting the release workflow if a credential setup fix is enough.

## Files Likely Affected
Server:
- `.github/workflows/publish-media.yml`
- `Agent/Docs/EXPO_MEDIA_PACKAGE.md`
- `packages/media/package.json`
- `bun.lock`

Client:
- None expected.

## Edge Cases
- If `0.1.1` is already published when work starts, skip publishing and only verify docs/task status.
- If trusted publishing succeeds but npm dist-tags do not update, inspect npm package state before rerunning.
- If the workflow bumps the package during a manual run by mistake, do not publish the unintended version without human confirmation.
- If package validation fails before publish, fix the package failure first and report that publish auth was not reached.
- If credentials are missing and cannot be configured by the agent, leave the spec unimplemented with a precise blocker rather than creating another version bump.

## Risks
- Repeated failed publish attempts can obscure whether the issue is npm package setup or workflow config. Mitigate by verifying package existence, trusted publisher settings, and token presence before rerunning.
