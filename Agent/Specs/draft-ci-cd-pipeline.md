# Spec: CI/CD Pipeline

**Status:** Draft
**Priority:** Medium
**Scope:** Client

---

## What

Create a GitHub Actions CI workflow that runs on every pull request: install dependencies (bun), type check (`tsc --noEmit`), run tests (jest), and lint (`expo lint`). Optionally document EAS Build trigger for main branch merges.

## Why

There is no CI/CD configuration in the project. PRs can be merged with type errors, failing tests, or lint violations. A CI pipeline catches regressions before they reach the main branch, enforces code quality standards automatically, and gives template users a working starting point they can extend for their own deployment needs.

## Current State

- No `.github/` directory exists in the project.
- `package.json` scripts available: `"test": "jest --watchAll"`, `"lint": "expo lint"`, `"build": "expo export -p web --output-dir dist"`.
- Package manager is `bun` with a `bun.lock` file.
- Jest is configured with `jest-expo` preset. Setup in `test/setup.ts`. Global timeout: 10000ms.
- ESLint uses flat config via Expo's ESLint config.
- TypeScript is in strict mode. `tsconfig.json` exists at project root.
- No `tsc --noEmit` script exists in `package.json` but TypeScript is a dev dependency.

## Changes

### 1. Create GitHub Actions CI workflow

**New file:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Lint, Type Check & Test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bunx tsc --noEmit

      - name: Lint
        run: bun run lint

      - name: Test
        run: bunx jest --ci --coverage --forceExit
```

Key decisions:
- `--frozen-lockfile` ensures CI uses exact lockfile versions (no surprise upgrades).
- `--ci` flag on jest disables watch mode and enables CI-friendly output.
- `--forceExit` prevents jest from hanging on open handles.
- `--coverage` generates coverage reports (useful for future coverage gates).
- `concurrency` with `cancel-in-progress` prevents wasted CI minutes on rapid pushes.
- `timeout-minutes: 15` prevents runaway jobs.

### 2. Add `typecheck` script to package.json

**File:** `package.json`

Add to scripts:

```json
"typecheck": "tsc --noEmit"
```

This makes type checking invocable locally with `bun run typecheck` and keeps the CI workflow readable.

### 3. Add `test:ci` script to package.json

**File:** `package.json`

Add to scripts:

```json
"test:ci": "jest --ci --coverage --forceExit"
```

Separates CI test behavior (no watch mode, coverage, forced exit) from the dev `test` script.

### 4. Document EAS Build integration

**New file:** `docs/ci-cd.md`

Document:
- What the CI workflow checks (types, lint, tests)
- How to extend for EAS Build triggers on main branch (using `expo-github-action` and `eas-cli`)
- Example EAS Build job snippet for main branch merges
- How to add secrets (`EXPO_TOKEN`) for EAS authentication
- How to add branch-specific build profiles (preview for PRs, production for main)

### 5. Update Agent docs

**File:** `Agent/Docs/ARCHITECTURE.md`

Add a CI/CD section noting the GitHub Actions workflow, what it checks, and where to extend it.

## Acceptance Criteria

1. `.github/workflows/ci.yml` exists and is valid YAML.
2. The workflow triggers on PRs to `main` and `dev`, and pushes to `main` and `dev`.
3. The workflow installs deps with `bun install --frozen-lockfile`.
4. The workflow runs `tsc --noEmit` and fails the build on type errors.
5. The workflow runs `expo lint` and fails the build on lint errors.
6. The workflow runs `jest --ci` and fails the build on test failures.
7. `package.json` has `typecheck` and `test:ci` scripts.
8. `docs/ci-cd.md` documents the pipeline and EAS Build extension.
9. No changes to existing source code or tests.

## Constraints

- The workflow must use `bun` (not npm or yarn) to match the project's package manager.
- Do not add EAS Build steps to the CI workflow by default. Template users may not have EAS configured. Document it as an opt-in extension.
- Do not add secrets or tokens to the workflow file. Document where they go.
- Keep the workflow simple and fast. One job, sequential steps. Template users can parallelize later if needed.
- Do not modify any existing scripts in `package.json` -- only add new ones.

## Out of Scope

- EAS Build automation (documented but not implemented)
- Deployment workflows (staging, production)
- Code coverage thresholds or enforcement
- Dependency caching optimization (bun is fast enough; users can add caching later)
- PR status checks / branch protection rules (GitHub settings, not code)
- E2E testing (Detox, Maestro, etc.)
- Release automation

## Files Likely Affected

**Client:**
- `.github/workflows/ci.yml` (new -- CI workflow)
- `package.json` (add `typecheck` and `test:ci` scripts)

**Docs:**
- `docs/ci-cd.md` (new -- pipeline docs and EAS Build extension guide)
- `Agent/Docs/ARCHITECTURE.md` (update with CI/CD section)

## Edge Cases

- **No tests exist yet:** `jest --ci` exits with code 0 if no test files are found (default behavior). The pipeline will pass, which is correct for a template.
- **ESLint config issues:** The workflow runs `bun run lint` which calls `expo lint`. If ESLint config has issues, the lint step will fail. This is intentional -- it surfaces the problem.
- **bun.lock out of sync:** `--frozen-lockfile` will fail if `bun.lock` doesn't match `package.json`. This is the correct behavior for CI.
- **Large monorepo checkout:** `actions/checkout@v4` with default settings fetches the full repo. For this template, that's fine. Document `fetch-depth: 1` as an optimization for large repos.

## Risks

- **Bun version drift:** Using `bun-version: latest` means the CI bun version may differ from local. Low risk since bun maintains backward compatibility, but template users may want to pin a specific version. Document this.
- **Expo lint compatibility:** `expo lint` may require certain Expo CLI versions. The `bunx` invocation should resolve the correct version from `node_modules`. If not, fall back to `npx expo lint`.
