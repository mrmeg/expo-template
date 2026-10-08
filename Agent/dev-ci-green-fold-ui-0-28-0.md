---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Turn dev CI green and fold Unreleased ui changes into 0.28.0

## Goal

`dev` CI ("Lint, Type Check, Test" → `bun run verify`) is red, which blocks the
next `dev` → `main` release. Fix the two pre-existing failures, then move the
`@mrmeg/expo-ui` `[Unreleased]` CHANGELOG entries into the never-published
0.28.0 section, so the first 0.28.0 publish carries the edge-lit shadows,
Toggle/ToggleGroup web targets and the Android BottomSheet footer fix.

## Context

Verified on `dev` at the merge of PR #148:

- npm has `@mrmeg/expo-ui` 0.27.1. `packages/ui/package.json` is 0.28.0 on
  both `main` and `dev`; no `expo-ui-v0.28.*` tag exists. The publish workflow
  (`.github/workflows/publish-packages.yml`) releases on a push to `main` only
  when a package's version changes in the push, so a `dev` → `main` merge with
  0.28.0 unchanged publishes nothing; the publish is a manual
  `workflow_dispatch` (`package=ui`, `version=0.28.0`, `ref=main`) Matt runs
  after the npm trusted publisher is set. Do not change any version.
- Failure 1 — typecheck (`bun run typecheck` and `bun run pkg ui typecheck`):
  `packages/ui/src/components/__tests__/nativeTextField.android.test.tsx(309,9)`
  TS2739: `{ value: "hello" }` passed as `value` lacks `get`/`set` of
  `ObservableState<string>`. `@expo/ui` 58 (root `~58.0.14`) added `get()` and
  `set()` to `ObservableState` (`node_modules/@expo/ui/build/universal/types.d.ts:89`,
  `build/State/useNativeState.d.ts:6`). Only test code is affected; the test
  asserts `props.value` is passed through by identity (`toBe(value)`).
- Failure 2 — jest: `client/features/media/__tests__/mediaClient.configured.test.tsx`
  and `mediaClient.unconfigured.test.tsx` fail with "No QueryClient set".
  Two copies of `@tanstack/react-query` resolve: root `node_modules` has
  5.104.1 (root `package.json:91` `^5.104.1`), and
  `packages/media/node_modules/@tanstack/react-query` has 5.104.0
  (`packages/media/package.json:145` devDependency `^5.101.4`; peer range
  `>=5.101.0 <6.0.0` at :109). The app's `QueryClientProvider` and the media
  package's hooks then use different React contexts.
- AGENTS.md: changing a package's `dependencies`, `peerDependencies`,
  `peerDependenciesMeta`, `exports` or `files` needs a version bump;
  `devDependencies` do not. CI installs with `bun install --frozen-lockfile`,
  so any dependency change must update `bun.lock`.
- `packages/ui/CHANGELOG.md`: `## [Unreleased]` (line 6) holds `### Changed`
  (edge-lit `getShadowStyle`; Button/Toggle/ToggleGroup 44pt web target) and
  `### Fixed` (Android BottomSheet footer/body inset). `## [0.28.0]` (line 44)
  starts with `### Added`. Keep-a-Changelog section order: Added, Changed,
  Deprecated, Removed, Fixed, Security.
- Previous release PRs (#141, #106, #100) are `dev` → `main`, titled
  "Release @mrmeg/expo-ui <version>".

## Work

1. Typecheck: in `nativeTextField.android.test.tsx` around line 306, build the
   test buffer as a full `ObservableState<string>` shape (`value`, `get`, `set`;
   cast through `unknown` only if the native `SharedObject` members are
   required), keeping the identity assertion. Check the rest of the file and
   `packages/ui/src` for other hand-built `ObservableState` literals
   (`grep -rn "value: \"" packages/ui/src/components/__tests__/nativeTextField*`)
   and fix them the same way. No runtime source changes.
2. React Query duplicate: raise `packages/media/package.json` devDependency
   `@tanstack/react-query` to `^5.104.1` (matching root) and run `bun install`
   so `bun.lock` resolves a single copy; confirm
   `packages/media/node_modules/@tanstack/react-query` no longer exists. Leave
   the peer range alone (no version bump). If bun still installs a nested copy,
   find which constraint forces it (`bun pm ls @tanstack/react-query` /
   `grep -n "react-query" bun.lock`) and align it; as a last resort map
   `^@tanstack/react-query$` to the root copy in the root jest config, and say so
   in the PR.
3. Run `bun run verify` and fix any other gate that fails on `dev`, within this
   scope (test/typing/lockfile fixes, no feature changes). If a failure needs a
   behavior change, stop and report it in the PR as an open question.
4. CHANGELOG fold: move every entry under `## [Unreleased]` into
   `## [0.28.0]`, merging into its existing `### Changed` / `### Fixed`
   subsections (create them in Keep-a-Changelog order if absent); leave
   `## [Unreleased]` as an empty heading. If 0.28.0 carries a release date,
   leave it. Check `packages/ui/README.md` and `docs/` for statements about
   what 0.28.0 contains and keep them consistent. Run `bun run docs:llms` if
   any source doc for `llms-full.txt` changed.

## Validation

- `bun install --frozen-lockfile` succeeds after the lockfile change.
- `bun run typecheck` and `bun run pkg ui typecheck`: zero errors.
- `bunx jest client/features/media` passes; `bun run test:ci` fully green.
- `bun run verify` passes end to end (fresh output in the PR).
- `bun run pkg ui test`, `bun run pkg media test`.
- `bun run packages:drift-check` (or the verify gate that runs it) passes —
  proves no version bump is needed.
- PR CI "Lint, Type Check, Test" is green.

## Merge plan

After this PR merges to `dev`, open the release PR `dev` → `main` titled
"Release @mrmeg/expo-ui 0.28.0" summarising the 0.28.0 CHANGELOG; leave it for
Matt to merge. Publishing stays manual (trusted publisher, then the
`workflow_dispatch` with `ref=main`).

## Exclusions

- No version changes for any package; no publish runs.
- No `server/http/compression.ts` fix (separate issue).
- No theme or palette changes.
