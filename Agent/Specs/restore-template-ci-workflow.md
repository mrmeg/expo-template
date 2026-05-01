# Spec: Restore Template CI Workflow

**Status:** Ready
**Priority:** Medium
**Scope:** Server + Client

---

## What
Add a lightweight CI workflow that validates the template on pull requests and pushes. The workflow should run install, typecheck, lint, tests, and any cheap bundle-size check that is stable in CI.

## Why
The template is meant to be reused across apps. Without CI, regressions in scaffolding, reusable components, server routes, or docs can land unnoticed and be copied into future projects.

## Current State
Recent git history removed `.github/workflows/ci.yml`, and there are currently no files under `.github/workflows`. `package.json` exposes `typecheck`, `lint`, `test:ci`, `build`, and `bundle-size` scripts, but only local/manual verification uses them.

## Changes
1. Add a GitHub Actions workflow.
   - Use a Node version compatible with Expo SDK 55 and Bun.
   - Install Bun and run `bun install --frozen-lockfile` or the Bun equivalent supported by this repo.
   - Run `bun run typecheck`.
   - Run `bun run lint`.
   - Run `bun run test:ci`.

2. Decide whether to include build/bundle checks.
   - Include `bun run bundle-size` only if it does not require a fresh web build or if the workflow first runs the required build.
   - Avoid expensive native builds in the default CI workflow.

3. Cache safely.
   - Cache Bun dependencies if useful.
   - Do not cache generated outputs that can hide build problems.

4. Document local parity.
   - Update `README.md` or `CONTRIBUTING.md` with the same validation command sequence.

## Acceptance Criteria
1. A `.github/workflows` CI file exists and runs on pull requests and pushes to the main development branches.
2. CI uses Bun and the committed `bun.lock`.
3. CI runs typecheck, lint, and Jest CI tests.
4. Workflow docs match local commands.
5. The workflow does not require private app credentials for default validation.

## Constraints
- Do not add native EAS build jobs.
- Do not require Stripe, Cognito, Sentry, or R2 secrets.
- Keep CI fast enough for routine template work.
- Fix the lint dependency spec first or include that fix before expecting CI to pass.

## Out of Scope
- Deployment pipelines.
- App-store builds.
- Preview environments.
- Coverage upload services.

## Files Likely Affected
Tooling:
- `.github/workflows/ci.yml`
- `package.json` only if script adjustments are needed

Docs:
- `README.md`
- `CONTRIBUTING.md`
- `Agent/Docs/PERFORMANCE.md` if bundle checks are included

## Edge Cases
- CI should pass with blank optional env vars.
- Tests that produce coverage should not leave tracked artifacts.
- Baseline browser mapping warnings should not fail CI unless configured as errors.
- If bundle-size needs `dist/`, the workflow must create it in the same job.

## Risks
Expo web builds can be heavier than simple validation. Start with typecheck/lint/test and add build or bundle-size only when it is reliable in GitHub Actions.
