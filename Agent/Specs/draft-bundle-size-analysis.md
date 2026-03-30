# Spec: Bundle Size Analysis

**Status:** Draft
**Priority:** Low
**Scope:** Client

---

## What

Add a bundle analysis script, document baseline bundle sizes, and add a size budget check that can be integrated into CI to warn when the bundle grows more than 10% from the baseline.

## Why

The project has no visibility into bundle size. Dependencies are added without understanding their cost, dead code accumulates silently, and there is no baseline to measure growth against. A bundle analysis workflow helps template users understand what is in their bundle, catch size regressions early, and make informed decisions about new dependencies.

## Current State

- `package.json` already has related scripts:
  - `"build": "expo export -p web --output-dir dist"` -- exports web build to `dist/`
  - `"build-sourcemap": "npx expo export --dump-sourcemap"` -- exports with source maps
  - `"view-sourcemap": "npx source-map-explorer dist/**/*.js --no-border-checks"` -- opens source-map-explorer visualization
- `source-map-explorer` is likely already a dev dependency (referenced in scripts).
- No `dist/` directory is committed (should be in `.gitignore`).
- No documented baseline sizes exist.
- No CI step checks bundle size.

## Changes

### 1. Add `analyze` convenience script

**File:** `package.json`

Add a single script that builds with source maps and opens the analysis:

```json
"analyze": "expo export -p web --output-dir dist --dump-sourcemap && npx source-map-explorer dist/**/*.js --no-border-checks"
```

This combines the existing `build-sourcemap` and `view-sourcemap` into one command for convenience.

### 2. Add `bundle-size` script for CI

**File:** `package.json`

Add a script that exports, measures the total JS bundle size, and compares against a baseline:

```json
"bundle-size": "node scripts/check-bundle-size.js"
```

### 3. Create bundle size check script

**New file:** `scripts/check-bundle-size.js`

A simple Node.js script that:

1. Runs `expo export -p web --output-dir dist` (or expects `dist/` to already exist).
2. Finds all `.js` files in `dist/` and sums their sizes (raw bytes).
3. Reads the baseline from `scripts/bundle-baseline.json`.
4. Compares current total against baseline.
5. If current exceeds baseline by more than 10%, exits with code 1 and prints a warning with the size delta.
6. If within budget, prints current size and exits with code 0.
7. Supports a `--update` flag to write the current size as the new baseline.

```js
// Pseudocode structure:
// 1. glob dist/**/*.js
// 2. sum file sizes
// 3. read baseline from bundle-baseline.json (or skip if missing)
// 4. compare: if (current > baseline * 1.10) exit(1)
// 5. if --update flag: write current to bundle-baseline.json
```

Keep this script dependency-free (only `fs` and `path`). No external packages required.

### 4. Create initial baseline file

**New file:** `scripts/bundle-baseline.json`

```json
{
  "totalBytes": 0,
  "lastUpdated": "",
  "note": "Run 'bun run bundle-size --update' to set the baseline after a clean build"
}
```

Set `totalBytes` to `0` initially. Template users run `bun run bundle-size --update` after their first build to establish their baseline. The check script treats a `0` baseline as "no baseline set" and skips the comparison (always passes).

### 5. Document bundle analysis workflow

**New file:** `docs/bundle-analysis.md`

Document:
- How to run `bun run analyze` to visualize the bundle
- How to set the baseline with `bun run bundle-size --update`
- How to check against the baseline with `bun run bundle-size`
- How to integrate into CI (add a step after the build that runs `bun run bundle-size`)
- How to interpret source-map-explorer output
- Common large dependencies to watch for in React Native / Expo projects
- The 10% threshold and how to adjust it

### 6. Update Agent docs

**File:** `Agent/Docs/PERFORMANCE.md`

Add a section on bundle size analysis, the baseline workflow, and the CI integration point.

## Acceptance Criteria

1. `bun run analyze` builds the web export with source maps and opens source-map-explorer.
2. `bun run bundle-size` compares current bundle size against the baseline and exits with appropriate code.
3. `bun run bundle-size --update` writes the current bundle size as the new baseline.
4. When no baseline is set (totalBytes is 0), the check passes with a message suggesting to set a baseline.
5. When the bundle exceeds the baseline by more than 10%, the script exits with code 1 and prints the current size, baseline, and percentage increase.
6. When the bundle is within budget, the script exits with code 0 and prints the current size.
7. `scripts/check-bundle-size.js` uses only Node.js built-in modules (no external dependencies).
8. `docs/bundle-analysis.md` documents the full workflow.
9. No changes to existing build scripts or source code.
10. All existing tests pass.

## Constraints

- Do not add heavy dependencies for bundle analysis. `source-map-explorer` is already available; lean on it.
- The check script must work with Node.js built-ins only (`fs`, `path`, `child_process`). No npm packages.
- Do not commit the `dist/` directory. Ensure it remains in `.gitignore`.
- The 10% threshold should be a constant at the top of the check script, easy to adjust.
- The script should work on macOS and Linux (CI). No Windows-specific paths.
- Do not make the bundle size check a blocking CI step by default. Document how to add it, but let template users decide.

## Out of Scope

- Tree-shaking optimization or dead code elimination (analysis only, not optimization)
- Per-route bundle splitting analysis (Expo's async routes handle this; analysis is complex)
- Native bundle size analysis (iOS .ipa / Android .apk -- different tooling)
- Automated PR comments with size diffs (requires GitHub API integration)
- Webpack/Metro bundle analyzer plugins (source-map-explorer is sufficient)
- Minification or compression analysis (gzip sizes, Brotli, etc.)

## Files Likely Affected

**Client:**
- `package.json` (add `analyze`, `bundle-size` scripts)
- `scripts/check-bundle-size.js` (new -- size check script)
- `scripts/bundle-baseline.json` (new -- baseline data)

**Docs:**
- `docs/bundle-analysis.md` (new -- workflow documentation)
- `Agent/Docs/PERFORMANCE.md` (update with bundle size section)

## Edge Cases

- **No `dist/` directory:** The check script should run the export first, or print a clear error message instructing the user to run the build first.
- **Empty `dist/`:** If the export produces no JS files, the total is 0 bytes. The script should warn that this seems wrong rather than silently passing.
- **Glob pattern mismatch:** Expo may output JS files in subdirectories of `dist/`. Use recursive file search, not a flat glob.
- **Baseline file missing:** If `bundle-baseline.json` is deleted, the script should create it with `totalBytes: 0` and suggest running with `--update`.
- **Concurrent runs:** Two runs writing to `bundle-baseline.json` simultaneously could corrupt it. Low risk in practice (CI runs sequentially). No special handling needed.
- **Source maps not generated:** The `analyze` script includes `--dump-sourcemap`. If source maps fail, `source-map-explorer` will error. This is the correct behavior -- the user needs to fix the build.

## Risks

- **Build time in CI:** Running `expo export -p web` takes 30-60 seconds. If added to CI, this increases pipeline time. Document that this step is optional and can run on a separate schedule or only on main branch pushes.
- **Flaky size comparisons:** Bundle size can fluctuate slightly between builds due to content hashing, timestamps, or dependency resolution changes. The 10% threshold is generous enough to absorb normal fluctuation while still catching significant regressions.
