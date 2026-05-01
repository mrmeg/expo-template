# Spec: Fix Lint Dependency

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What
Restore the lint command so `bun run lint` can load the ESLint flat config and run against the source tree. The fix should address the missing `globals` package referenced by the current config without broad lint-rule churn.

## Why
The template should ship with working quality gates. Any new app cloned from this repo currently inherits a broken lint command, which makes the starter feel unreliable before app-specific work begins.

## Current State
`eslint.config.mjs` imports `globals` at line 3 and uses `globals.browser` when building `languageOptions.globals`. `package.json` does not list `globals` in dependencies or devDependencies, so `bun run lint` exits before linting source with `ERR_MODULE_NOT_FOUND`.

## Changes
1. Restore the ESLint config dependency.
   - Add `globals` to `devDependencies` in `package.json`.
   - Update `bun.lock` through the package manager.
   - Keep the existing flat config shape unless another required ESLint 10 compatibility issue appears.

2. Verify the lint entry point.
   - Run `bun run lint`.
   - If lint then exposes actual source warnings/errors, address only issues that are required for the command to pass or document them in the implementation summary.

3. Update docs only if command instructions drift.
   - Keep `README.md`, `CONTRIBUTING.md`, and Agent docs aligned on the canonical lint command.

## Acceptance Criteria
1. `bun run lint` no longer fails with `Cannot find package 'globals'`.
2. `bun run lint` completes successfully or reports only intentional source lint findings that are fixed in the same task.
3. `package.json` and `bun.lock` remain consistent.
4. No unrelated ESLint rule rewrites are included.

## Constraints
- Use Bun for dependency changes.
- Do not relax lint rules to hide the dependency failure.
- Do not introduce a second lint config.

## Out of Scope
- Adding CI.
- Reworking lint rules across the repo.
- Migrating off Expo lint.

## Files Likely Affected
Client / tooling:
- `package.json`
- `bun.lock`
- `eslint.config.mjs` only if needed for compatibility

Docs:
- `README.md`
- `CONTRIBUTING.md`

## Edge Cases
- If `globals` is already transitive after install, it still must be direct because the config imports it directly.
- If lint reveals pre-existing warnings, keep fixes narrowly scoped.
- If Expo lint has changed behavior, prefer the minimum config adjustment that preserves current conventions.

## Risks
Adding a new package can alter the lockfile substantially. Review the lockfile diff and avoid dependency upgrades unrelated to `globals`.
