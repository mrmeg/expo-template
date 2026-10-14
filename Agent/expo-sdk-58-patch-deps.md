---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Align Expo SDK 58 patch versions and apply safe JS patch/minor bumps

## Goal

Make `bunx expo install --check` and expo-doctor's SDK version check pass again. SDK 58's current patch set moves 15 packages, including `react-native` 0.88.0-rc.3 → rc.4. In the same lockfile change, take the safe patch and minor bumps for non-SDK packages and refresh the stale version table in `docs/migration-guide.md`. Only manifests, `bun.lock`, and docs change. `ios/` and `android/` are gitignored (CNG; `git ls-files ios android` is empty), so there is no Podfile.lock or native project churn.

## Context

Verified on `dev` @ 925429a (2026-10-13):

- `bunx expo install --check` prints "Found outdated dependencies" and lists 15 packages. It also skips `@sentry/react-native` because that package is in `expo.install.exclude`. expo-doctor fails 2 of 20 checks:
  - "Check that packages match versions required by installed Expo SDK": 14 patch mismatches. Its table omits react-native.
  - "Check that no duplicate dependencies are installed": nested copies under `node_modules/expo/node_modules/{expo-constants,expo-file-system,expo-font,@expo/log-box}` and `node_modules/expo-asset/node_modules/expo-constants`. None of these are in `bun.lock` (it has no `expo/expo-*` keys). They are stale directories in the main checkout. The main checkout also has a stale `packages/media/node_modules/@tanstack/react-query@5.104.0` that is not in the lockfile. That copy is the likely cause of the vault's local "No QueryClient set" failure in `mediaClient.*.test.tsx`. A fresh install should have neither problem.
- The expected versions come from Expo's remote SDK data. The extracted `expo@58.0.7/bundledNativeModules.json` agrees with them:
  - `react-native` 0.88.0-rc.4 and `react-native-web` ~0.21.4.
  - Unchanged native pins: gesture-handler ~3.2.1, screens ~4.28.0, safe-area ~5.9.1, keyboard-controller 1.22.4, reanimated 4.7.0, worklets 0.13.0, svg 15.15.5, async-storage 2.2.0.
  - `@sentry/react-native` ~8.28.0. The repo deliberately runs ahead of this through `expo.install.exclude`.
- On npm, `react-native` `next` is rc.5. Expo expects rc.4, so stay on rc.4.
- `jest-expo` 58.0.9 peers `@react-native/jest-preset ^0.88.0-rc.4` and `jest ^30`. The repo already runs jest 29 and preset rc.0 under jest-expo 58.0.8, which peers `jest ^30` and preset `^0.88.0-rc.3`, so both peer warnings predate this change. Bumping the preset to rc.4 clears the preset warning; the jest one stays. Keep jest 29.
- `react-native-purchases-ui@10.13.0` peers `react-native-purchases` at exactly 10.13.0, so the two move together.
- `@sentry/react-native@8.30.0`:
  - Still depends on `@sentry/cli` 3.8.0, which matches the root devDependency.
  - Bundles `@sentry/core`/`@sentry/react` 10.76.0, while the app's web `@sentry/react` is pinned at 11.5.0.
  - Removes the `maxTransactionDurationExceeded` span attribute. The repo does not use it.
  - Is a native minor bump: Cocoa 9.30.1, Android 8.60.0.
- `bun.lock` currently holds exactly one entry each for `react-native` (rc.3), `@tanstack/react-query` (5.104.1), and `@react-native/jest-preset` (rc.0). Its header is `lockfileVersion: 1`, `configVersion: 1`. `bunfig.toml` sets `linker = "hoisted"`.
- Bun is pinned at 1.3.14 in `.bun-version`, and CI installs with `bun install --frozen-lockfile`.
- `docs/migration-guide.md:23-42` "Target Baseline (September 2026)" is stale. It lists expo ^58.0.0-preview.2, expo-router ~58.0.3, expo-server ~58.0.0, react 19.2.3, react-native 0.88.0-rc.0, react-native-web ^0.21.2, @mrmeg/expo-ui ^0.25.0, @mrmeg/expo-media ^0.5.0, @tanstack/react-query ^5.102.8, react-hook-form ^7.87.0, zod ^4.5.4, and jest-expo ~58.0.2.
- Line 159 says "Upgrade to `@mrmeg/expo-ui@^0.25.0`", but line 166 already documents 0.29.0 icons. That guide is a source in `scripts/build-llms-full.mjs`, so `llms-full.txt` must be regenerated. `bun run verify` gates it through `gen --check`.
- `packages:drift-check` compares only `dependencies`, `peerDependencies`, `peerDependenciesMeta`, `exports`, and `files`. Changing devDependencies in `packages/media` and `packages/purchases` needs no package version bump.
- `workers/media` is outside the root tsconfig and outside `verify`. It has its own `bun run typecheck`, and its README documents `bunx wrangler deploy --dry-run --outdir=dist-check` (`dist-check/` is gitignored).
- `app.config.ts` uses `runtimeVersion: { policy: "fingerprint" }` when updates are enabled. The RN and native-module patches change the fingerprint.
- CI runs `validate` (`bun run verify`) and `bundle-size` (`bun run build` + `bun run bundle-size`, failing on more than 10% growth over `scripts/bundle-baseline.json`) with no `.env`. Package Compatibility also runs, because `package.json`, `bun.lock`, and `packages/*` change.

Quirks that bind this work (vault note):

- The main checkout may carry another thread's uncommitted dependency bumps. Never `bun install`, reset, or stash there. Do everything in the agent worktree.
- If you run native: `expo run:ios|android` keeps Metro attached, so use `--no-bundler`.

## Work

Implement in a fresh git worktree on this spec's `agent/*` branch off `dev`, never in `/Users/mattmegenhardt/Development/expo-template` itself. Do not copy or symlink `node_modules` or `.env` into the worktree.

1. Run `bun --version` and confirm it prints `1.3.14`. Then run `bun install --frozen-lockfile` in the worktree root as a clean baseline, before editing anything.

2. Edit the manifests by hand, changing only the strings below.

   Root `package.json` `dependencies`:

   | Package | From | To |
   |---|---|---|
   | @clerk/backend | ^3.23.1 | ^3.23.2 |
   | @expo/metro-runtime | ~58.0.13 | ~58.0.14 |
   | @expo/ui | ~58.0.14 | ~58.0.15 |
   | @sentry/react-native | ^8.29.0 | ^8.30.0 (stays in `expo.install.exclude`) |
   | @tanstack/react-query | ^5.104.1 | ^5.104.2 |
   | expo | ~58.0.6 | ~58.0.7 |
   | expo-auth-session | ~58.0.9 | ~58.0.10 |
   | expo-crypto | ~58.0.5 | ~58.0.6 |
   | expo-dev-client | ~58.0.11 | ~58.0.12 |
   | expo-file-system | ~58.0.7 | ~58.0.8 |
   | expo-localization | ~58.0.3 | ~58.0.4 |
   | expo-router | ~58.0.16 | ~58.0.17 |
   | expo-server | ~58.0.3 | ~58.0.4 |
   | expo-splash-screen | ~58.0.6 | ~58.0.7 |
   | expo-video | ~58.0.8 | ~58.0.9 |
   | i18next | ^26.4.2 | ^26.4.4 |
   | react-hook-form | ^7.89.0 | ^7.90.0 |
   | react-native | 0.88.0-rc.3 | 0.88.0-rc.4 (exact, no range) |
   | react-native-web | ^0.21.3 | ^0.21.4 |
   | zod | ^4.6.5 | ^4.6.7 |

   Root `package.json` `devDependencies`:

   | Package | From | To |
   |---|---|---|
   | @react-native/jest-preset | 0.88.0-rc.0 | 0.88.0-rc.4 (exact, matches RN) |
   | @testing-library/react-native | ^14.0.1 | ^14.1.0 |
   | @types/node | ^26.6.4 | ^26.6.5 |
   | @typescript-eslint/eslint-plugin | ^8.71.1 | ^8.71.2 |
   | @typescript-eslint/parser | ^8.71.1 | ^8.71.2 |
   | jest-expo | ~58.0.8 | ~58.0.9 (stays a devDependency) |

   Workspace devDependencies:

   | File | Package | From | To |
   |---|---|---|---|
   | `packages/media/package.json` | @tanstack/react-query | ^5.104.1 | ^5.104.2 (same string as root) |
   | `packages/purchases/package.json` | react-native-purchases | 10.10.1 | 10.13.0 (exact) |
   | `packages/purchases/package.json` | react-native-purchases-ui | 10.10.1 | 10.13.0 (exact, same as above) |
   | `workers/media/package.json` | @cloudflare/workers-types | ^5.20260901.1 | ^5.20261013.1 |
   | `workers/media/package.json` | wrangler | ^4.127.1 | ^4.149.0 |

   Leave these pins exactly as they are:
   - Package `peerDependencies` and package `version` fields.
   - `react`/`react-dom` 19.3.0 and `@types/react` ~19.3.0.
   - `@sentry/react` 11.5.0 and `@sentry/cli` 3.8.0.
   - `lucide-static` 1.55.0.
   - The SDK native pins: gesture-handler ~3.2.1, screens ~4.28.0, safe-area ~5.9.1, keyboard-controller 1.22.4, reanimated 4.7.0, worklets 0.13.0, svg 15.15.5, async-storage 2.2.0.
   - The toolchain: `typescript` ~6.0.3, `jest` ~29.7.0, `@types/jest` 29.5.14, `@babel/core` ^7.29.7.
   - `overrides` and `workers/media/wrangler.jsonc` (including `compatibility_date`).

3. Run `bun install` once in the worktree root. This is the only install command.
   - Do not run unscoped `bun update`.
   - Do not delete or regenerate `bun.lock` from scratch.
   - Do not run `bun add` for packages outside the tables above, except through the step-4 float rule.

4. Float rule: tilde ranges resolve to the newest 58.0.x on the day of the install. If `bunx expo install --check` still lists packages after step 3 because Expo published a newer SDK 58 patch, set those packages to exactly the versions it expects. Hand-edit them or run `bunx expo install --fix`, keeping `jest-expo` in devDependencies and `@sentry/react-native` excluded. Then run `bun install` again. The limits:
   - Set `react-native` exactly to the version Expo expects (rc.4 today). Never take npm's `next` (rc.5) on your own.
   - Keep `@react-native/jest-preset` equal to `react-native`.
   - Never move a native module past the version in the installed `node_modules/expo/bundledNativeModules.json`.

5. In `docs/migration-guide.md`:
   - Rename the heading `## Target Baseline (September 2026)` to `## Target Baseline (October 2026)`. Nothing links to its anchor.
   - Rewrite the table rows to match the manifests:

     | Row | New value |
     |---|---|
     | expo | `~58.0.7 (SDK 58 beta)` |
     | expo-router | `~58.0.17` |
     | expo-server | `~58.0.4` |
     | react / react-dom | `19.3.0` |
     | react-native | `0.88.0-rc.4` |
     | react-native-web | `^0.21.4` |
     | @mrmeg/expo-ui | `^0.29.0` |
     | @mrmeg/expo-media (if using media) | `^0.5.2` |
     | zustand | `^5.0.15` |
     | @tanstack/react-query | `^5.104.2` |
     | react-hook-form | `^7.90.0` |
     | zod | `^4.6.7` |
     | typescript | `~6.0.3 (strict)` |
     | jest-expo | `~58.0.9` |
     | @testing-library/react-native | `^14.1.0` |
     | eslint | `^10 (flat config)` |

     If step 4 moved anything, use the final resolved ranges instead.
   - On line 159, change `@mrmeg/expo-ui@^0.25.0` to `@mrmeg/expo-ui@^0.29.0`. The peer list in that sentence omits `react-native-svg`, which `packages/ui/package.json` peers at `>=15.0.0 <16.0.0`: insert `` `react-native-svg` ≥ 15 < 16; `` after the `react-native-screens` entry. Leave the other peer ranges, which match. Change the table row and line 159 together or not at all: the doc reaches `main` only with the dev → main release that publishes 0.29.0.
   - Leave Phase 1's `expo@next` wording alone. It is still accurate, because `next` is 58.0.7.

6. Run `bun run docs:llms` to regenerate `llms-full.txt` (and `llms-examples.txt`, if it changes). Never hand-edit either file.

## Validation

Run all of these in the worktree. Report each result from fresh output.

- `bunx expo install --check`: the only output should be the `@sentry/react-native` skip notice (the worktree has no `.env`, so no `env: load .env` lines either), with no "Found outdated dependencies".
- `bunx expo-doctor`: the gate is that "Check that packages match versions required by installed Expo SDK" no longer appears as failed, not the command's exit code. Report the "no duplicate dependencies" check separately. It should pass on a clean worktree. If it doesn't, report the paths instead of fixing them.
- Lockfile hygiene:
  - `head -3 bun.lock` still shows `lockfileVersion: 1` and `configVersion: 1`.
  - `bun install --frozen-lockfile` is a no-op.
  - Each of these prints exactly one line, showing the new version. The optional prefix also catches nested copies, so a second line means a duplicate.
    - `grep -nE '"([^"]+/)?react-native": \["react-native@' bun.lock` (rc.4)
    - `grep -nE '"([^"]+/)?@tanstack/react-query": \["@tanstack/react-query@' bun.lock` (5.104.2)
    - `grep -nE '"([^"]+/)?@react-native/jest-preset": \["' bun.lock` (rc.4)
  - `grep -nE '^    "(expo|expo-asset)/(expo-[a-z-]+|@expo/log-box)": ' bun.lock` prints nothing.
- `bun run docs:versions:check` passes.
- `bun run verify` passes all gates: peer-check, drift-check, typechecks, lint, check:features, `gen --check`, docs:versions:check, and test:ci.
  - If a `mediaClient.*.test.tsx` fails with "No QueryClient set", first check for a nested copy with `ls packages/media/node_modules/@tanstack`.
  - Report whether those tests pass in the clean worktree; this is evidence for the vault issue. Fixing that issue is not part of this spec.
- `bun run build`, then `bun run bundle-size`: it must pass against the existing baseline. Never run `bundle-size --update`. If it fails, stop and report the delta.
- Web smoke: after the build, run `PORT=3000 bun run start` in the background. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` should print 200, and the HTML body should carry server-rendered route markup, not an empty root. If a browser tool is available, load `/` and a tab route, and confirm they hydrate with no console errors. Stop the server afterwards. A crash at `server/http/compression.ts:198` (`TypeError: null is not an object` while compressing a 404) predates this change and is a known issue. Note it and keep validating; it is not grounds for a rollback.
- `workers/media` (cwd `workers/media`):
  - Run `bun run typecheck`, then `bunx wrangler deploy --dry-run --outdir=dist-check`, which bundles locally and uploads nothing.
  - Never run `wrangler deploy` without `--dry-run`, and never run any other wrangler command that talks to Cloudflare.
  - Remove `dist-check/` afterwards. It is gitignored either way.
- `git status --short` (which, unlike `git diff --stat`, also lists untracked files) shows only these files: `package.json`, `packages/media/package.json`, `packages/purchases/package.json`, `workers/media/package.json`, `bun.lock`, `docs/migration-guide.md`, `llms-full.txt`, and `llms-examples.txt` (only if regenerated). Nothing under `Agent/`, and no untracked build output: `dist/` and `workers/media/dist-check/` are gitignored and must not appear.
- Optional native smoke, which does not gate the PR: if Xcode is available, run `bunx expo prebuild --clean` and then `bunx expo run:ios --no-bundler` in the worktree. Both write only the gitignored `ios/`. Report whether the build compiled.

## Exclusions

- Majors: TypeScript 7, jest 30, @types/jest 30, @babel/core 8, async-storage 3.
- Native modules past the SDK 58 pins: gesture-handler 3.3, screens 4.29, safe-area 5.10.1, keyboard-controller 1.22.7, reanimated 4.7.1.
- `react-native` rc.5, until Expo expects it.
- `lucide-static` 1.56. It would regenerate the icon snapshot, and the unreleased 0.29.0 entry in `packages/ui/CHANGELOG.md` names Lucide 1.55.0.
- `@sentry/react` (11.5.0, with 11.7.0 available). The web SDK is on major 11, while `@sentry/react-native` bundles 10.76.0. Whether to bump or align it is Matt's decision.
- Leave these alone even though a grep for old versions finds them:
  - The migration guide's "Appendix — Portfolio Tier Scan (June 2026)" table.
  - `docs/styling-engine-comparison.md:12`, a dated measurement.
  - The floor fixtures in `scripts/package-compatibility-profiles.mjs`.
  - The "React 19.2" claims in `README.md`/`AGENTS.md`. React is 19.3.0, but that drift belongs to a separate docs fix.
  - The stale baseline figure in `docs/bundle-analysis.md`.
- The stale `node_modules` directories in the main checkout. Do not touch that checkout.

## Merge plan

- One draft PR into `dev`. No package version bumps or CHANGELOG entries, because only package devDependencies change.
- Watch the `validate`, `bundle-size`, and Package Compatibility CI jobs.
- The PR ships with the next dev → main release, alongside the unpublished expo-ui 0.29.0. Media and purchases do not republish, because their versions are unchanged.
- The fingerprint runtime version changes, so existing dev clients and builds will not accept this JS. Matt's pending dev-build checks on `dev` (sign-in Continue, dark shadows) need a fresh dev client built after merge.
