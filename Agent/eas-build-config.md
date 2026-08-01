---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# EAS build profiles and workflows

## Goal

Ship `eas.json` with development/preview/production profiles and a starter `.eas/workflows/` so a project cut from this template can run cloud builds and OTA updates on day one, instead of authoring EAS config from scratch.

## Context

- No `eas.json` and no `.eas/` directory exist.
- `app.config.ts` already anticipates EAS: `resolveUpdatesChannel()` maps `EAS_BUILD_PROFILE` (development/preview/production) to channels via `CHANNEL_BY_PROFILE`, and `resolveBuildNodeHeapMb()` feeds `plugins/withNativeBuildSettings` (default 32 GB Node heap for native bundling).
- There is **no** `updates` block or `runtimeVersion` in `app.config.ts` — EAS Update is not wired. There is also no EAS `projectId`, since the template must stay account-agnostic.
- **`expo-updates` is not installed.** An `updates`/`runtimeVersion` block is inert without it, so step 2 installs it.
- Template principle (AGENTS.md:51): everything optional fails closed; a blank `.env` keeps the template working. EAS config must follow — no hardcoded project id.
- `expo-dev-client` (`~57.0.9`) is a dependency, so the development profile should build a dev client.
- `eas-cli` is installed globally (20.5.1) but this repo is **not linked to an EAS project**. That shapes what can be validated — see Validation.

## Work

1. Add `eas.json`. Profile keys below are confirmed against the installed `@expo/eas-json` schema (`build/build/types.d.ts`):
   - `cli.appVersionSource: "remote"` (enum is `local | remote`).
   - `development`: `developmentClient: true`, `distribution: "internal"`.
   - `development-simulator`: `extends: "development"` plus `ios: { simulator: true }` (`simulator` lives on the per-platform `ios` block, and `extends` is a valid profile key).
   - `preview`: `distribution: "internal"`, `channel: "preview"`.
   - `production`: `distribution: "store"`, `channel: "production"`, `autoIncrement: true`.
   - Channel names must match `CHANNEL_BY_PROFILE` in `app.config.ts` (development/preview/production) — that map is keyed on `EAS_BUILD_PROFILE`, so profile names are load-bearing.
2. Install `expo-updates` (`bunx expo install expo-updates`) and gate the update wiring in `app.config.ts` on env: when `EAS_PROJECT_ID` is set, add `extra.eas.projectId`, `updates.url: https://u.expo.dev/<id>`, and `runtimeVersion: { policy: "fingerprint" }`; when unset, omit all three so `expo config` stays valid without an account. Follow the existing `readOptionalEnv()` / `readSentryNativeUploadConfig()` gating style. Add `EAS_PROJECT_ID` to `.env.example` with a comment.
3. Add starter workflows under `.eas/workflows/` (consult the expo-cicd-workflows skill for current YAML schema):
   - `build-preview.yml`: iOS + Android preview builds on manual dispatch.
   - `update-production.yml`: publish an EAS Update to the channel matching the branch on push to `main`, gated so it no-ops when the project isn't linked.
4. Add a `## Deployment` section to `README.md` (there is no existing deployment section — put it next to `## CI`): `eas init` → set `EAS_PROJECT_ID` → profiles/channels table.

## Validation

- `bunx expo config --type public` succeeds with no `EAS_PROJECT_ID` (no `updates`/`runtimeVersion` in output) and with a dummy one set (both present — inspect output).
- `eas config --platform ios --profile production --non-interactive` **does** validate `eas.json` against the schema before it needs a linked project: with a bad value it prints `eas.json is not valid` + the offending keys; with a valid file it fails later at `EAS project not configured` (verified against eas-cli 20.5.1 in a scratch dir). Treat "reaches the *project not configured* error" as the pass signal; a schema error is a real failure.
- `eas workflow:validate .eas/workflows/<file>.yml` cannot validate YAML here — it resolves `eas.json` **and** the EAS project first, so it always stops at `EAS project not configured`. Workflow YAML is therefore reviewed against the expo-cicd-workflows skill schema only; say so in the PR rather than claiming it validated.
- `bun run typecheck && bun run test:ci`. Note: **no test loads `app.config.ts`** — only `__tests__/appIdentity.test.ts` covers `app.identity.js`. The gating in step 2 is verified by the `expo config` runs above, not by the suite.

## Out of scope

- Store submission profiles/credentials (`eas submit`), Apple/Google credential setup.
- Migrating GitHub Actions CI to EAS Workflows.
- Actually linking this repo to an EAS project.

## Open questions

- None.
