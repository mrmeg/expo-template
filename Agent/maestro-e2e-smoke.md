---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Maestro E2E smoke flows

## Goal

Add a minimal Maestro suite (`.maestro/`) covering launch, onboarding, and tab navigation, so native regressions that ~86 unit suites can't see (navigation wiring, splash/startup gating, provider crashes) get a repeatable check.

## Context

- No E2E exists (no `.maestro/`, `e2e/`, detox, or playwright config).
- Startup path: splash screen holds until fonts + i18n + onboarding + auth bootstrap resolve (`client/features/app/useAppStartup.ts`); with a blank `.env`, auth is disabled and the app must remain fully explorable (AGENTS.md fail-closed rule) — this no-env state is what the smoke flows should target, so they run with zero secrets.
- Onboarding gate: first launch shows onboarding (`client/features/onboarding/OnboardingFlow.tsx`, horizontal pager); completion is persisted, so flows must either clear state (`clearState: true` in the launch step) or handle both branches.
- App identity (scheme, bundle id) comes from `app.identity.js` env defaults; flows should read the app id from an env var with the template default, not hardcode it.
- Route paths contain parentheses groups (e.g. `app/(main)/(tabs)/`); quote them in any shell commands (AGENTS.md).

## Work

1. Add `.maestro/` flows, each independent and runnable against a dev-client or release build with blank env:
   - `launch.yml`: cold launch with `clearState: true`, assert onboarding's first screen renders.
   - `onboarding.yml`: complete the onboarding pager, assert landing on the main tabs.
   - `tabs.yml`: visit each tab (read the tab set from `app/(main)/(tabs)/`), assert a stable element per screen. Prefer `testID`s; add them to screens where no stable accessibility text exists (keep additions minimal).
   - `showcase.yml`: open the showcase list and one template screen (validates the template registry end-to-end).
2. Add `"e2e": "maestro test .maestro"` to root `package.json` and a short `docs/e2e.md` (install Maestro, build the app, run) — include `bun run docs:llms` regeneration if `docs/` walks pick it up.
3. Do NOT wire into GitHub Actions in this spec — macOS runners + simulator boot are a cost decision. Leave a note in `docs/e2e.md` about the follow-up.

## Validation

- `bun run typecheck && bun run lint && bun run test:ci` (testID additions must not break snapshot/query-based unit tests).
- Run the suite on an iOS simulator against a local build (`bunx expo run:ios --configuration Release` or the dev client) with no `.env`: all flows pass. If the Maestro CLI is not installed in the implementation environment, install it via the documented command; if that's blocked, state the exact blocker in the PR rather than claiming the flows pass.
- Run `launch.yml` twice in a row to prove `clearState` handling makes flows idempotent.

## Out of scope

- Android flow runs (flows should avoid iOS-only selectors, but Android verification is a follow-up).
- CI integration.
- Auth-provider flows (require real keys; smoke suite is the no-env path only).

## Open questions

- None.
