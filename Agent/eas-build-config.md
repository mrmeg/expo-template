---
status: draft
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
- Template principle (AGENTS.md): everything optional fails closed; a blank `.env` keeps the template working. EAS config must follow — no hardcoded project id.
- `expo-dev-client` is a dependency, so the development profile should build a dev client.

## Work

1. Add `eas.json`:
   - `development`: `developmentClient: true`, `distribution: "internal"`, iOS simulator variant included (`ios.simulator: true` on a `development-simulator` profile or per current EAS schema).
   - `preview`: internal distribution, channel `preview`.
   - `production`: store distribution, channel `production`, `autoIncrement` for build numbers.
   - `cli.appVersionSource: "remote"` (or current recommended default — verify against installed EAS CLI schema).
2. Gate EAS Update wiring in `app.config.ts` on env: when `EAS_PROJECT_ID` is set, add `extra.eas.projectId`, `updates.url: https://u.expo.dev/<id>`, and `runtimeVersion: { policy: "fingerprint" }`; when unset, omit all three so `expo config` stays valid without an account. Add `EAS_PROJECT_ID` to `.env.example` with a comment.
3. Add starter workflows under `.eas/workflows/` (consult the expo-cicd-workflows skill for current YAML schema):
   - `build-preview.yml`: iOS + Android preview builds on manual dispatch.
   - `update-production.yml`: publish an EAS Update to the channel matching the branch on push to `main`, gated so it no-ops when the project isn't linked.
4. Document setup in `README.md` deployment section: `eas init` → set `EAS_PROJECT_ID` → profiles/channels table.

## Validation

- `bunx expo config --type public` succeeds with no `.env` (no projectId) and with a dummy `EAS_PROJECT_ID` (updates block present — inspect output).
- `bunx eas config` (or `eas build --profile development --platform ios --dry-run` equivalent if available in the installed CLI) validates `eas.json` without an authenticated account, or state the blocker if the CLI requires auth.
- `bun run typecheck && bun run test:ci` (app.config change is covered by config-load validation).
- Workflow YAML validated against the expo-cicd-workflows skill schema (no runnable CI check exists for these — say so in the PR).

## Out of scope

- Store submission profiles/credentials (`eas submit`), Apple/Google credential setup.
- Migrating GitHub Actions CI to EAS Workflows.
- Actually linking this repo to an EAS project.

## Open questions

- None.
