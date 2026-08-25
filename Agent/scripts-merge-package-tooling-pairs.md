---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/71
---

# Merge the three ui/media near-duplicate script pairs

## Goal
Three pairs of package-tooling scripts are copy-pasted per package with tiny
diffs. Parameterize each pair into one script, removing ~350–400 LOC and the
risk of the copies drifting (they already have: the esm-fixup pair differs by
~59 lines, mostly ui-only platform-suffix handling).

## Context
- `scripts/release-ui-package.mjs` (154 LOC) vs
  `scripts/release-media-package.mjs` (152): diff after name normalization is
  ~22 lines.
- `scripts/check-ui-package-consumer.mjs` (269) vs
  `scripts/check-media-package-consumer.mjs` (246): same skeleton (temp
  fixture, tarball install, smoke export).
- `scripts/fix-ui-package-esm.mjs` (93) vs `scripts/fix-media-package-esm.mjs`
  (67): shared core plus ui-only platform-suffix handling.
- Referencers that must be updated in lockstep:
  - `scripts/run-package-script.mjs` command table (dispatches
    `ui:release`, `media:release`, `ui:consumer-smoke`,
    `media:consumer-smoke`, etc.).
  - `scripts/__tests__/runPackageScript.test.ts` — asserts the exact release
    script paths (lines ~55, ~61, ~71: `node
    scripts/release-ui-package.mjs --patch --publish` etc.).
  - `packages/ui/package.json` and `packages/media/package.json` `build`
    scripts (call the esm-fixup scripts by relative path).
  - `.github/workflows/publish-ui.yml` and `publish-media.yml` (consumer
    checks and release flow).
- Precedent in-repo: `scripts/run-package-script.mjs` itself exists because
  12 copy-pasted root scripts were collapsed into a table; and
  `scripts/package-compatibility-profiles.mjs` is already a shared data
  module imported by two checkers. Follow the same style.

## Work
1. `scripts/release-package.mjs`: single script taking the package name
   (`node scripts/release-package.mjs ui --patch --publish`), containing the
   union of the pair; delete both originals.
2. `scripts/check-package-consumer.mjs`: parameterized consumer-smoke;
   per-package differences (fixture contents, entry imports) live in a small
   config object keyed by package name; delete both originals.
3. `scripts/fix-package-esm.mjs`: shared core; the ui platform-suffix pass
   runs only for `ui` (flag or config-keyed); delete both originals.
4. Update every referencer listed in Context (run-package-script table, its
   test's expected command strings, both packages' `build` scripts, both
   publish workflows).
5. Keep CLI ergonomics: `bun run ui:release -- --patch` etc. must behave
   exactly as before (the run-package-script table absorbs the package-name
   argument).

## Validation
- `bunx jest scripts` — green (runPackageScript, verify, generate suites).
- `bun run ui:build && bun run media:build` (exercise the esm fixups; diff
  `packages/*/dist` against a pre-change build — output must be
  byte-identical).
- `bun run ui:consumer-smoke && bun run media:consumer-smoke` (slow but the
  only real test of the merged consumer script).
- `bun run ui:pack && bun run media:pack`.
- Dry-run the release script for both packages if it supports a no-publish
  mode (`--patch` without `--publish`); otherwise verify argument parsing
  with a unit test.
- Grep both publish workflows for the old script names — zero matches.

## Out of scope
- `check-package-peer-compatibility.mjs` / `check-package-consumer-profile.mjs`
  (already shared), `verify.mjs`, codegen scripts.
- Any change to what the release/consumer flows actually do.

## Merge plan
No overlap with the other open specs. Note for the reviewer: the publish
workflows only run on `main` push / dispatch, so a broken path would surface
at publish time — the workflow-file grep in Validation is the guard.
