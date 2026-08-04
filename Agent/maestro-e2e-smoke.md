---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/33
---

# Maestro E2E smoke flows

## Goal

Add a minimal Maestro suite (`.maestro/`) covering launch, onboarding, and tab navigation, so native regressions that the 84 unit suites can't see (navigation wiring, splash/startup gating, provider crashes) get a repeatable check.

## Context

- No E2E exists (no `.maestro/`, `e2e/`, detox, or playwright config). The **Maestro CLI is installed** (2.8.0).
- Startup path: on native `RootLayout` returns `null` until `useAppStartup` resolves fonts + i18n + onboarding persistence + auth bootstrap (`client/features/app/useAppStartup.ts`), and `SplashScreen.hideAsync()` fires on `ready`. With a blank `.env` auth is disabled (`authBootstrapped` starts `true`) and the app must remain fully explorable (AGENTS.md:51) — this no-env state is what the flows target, so they run with zero secrets. Note the repo has a real `.env`; flows must be run with it moved aside or with the relevant vars blank.
- Onboarding is **not a route** — it's a shell branch: `RootLayout` renders `<OnboardingGate />` instead of the `(main)` Stack while `hasSeenOnboarding` is false (`client/features/app/RootLayout.tsx:151`). State is persisted under the AsyncStorage key `has-seen-onboarding`, so flows must use `clearState: true` on launch.
- Useful existing testIDs (already present, no edits needed): `onboarding-gate` on the gate wrapper, and on the pager `onboarding-flow`, `onboarding-page`, `onboarding-title`, `onboarding-description`, `onboarding-skip-button`, `onboarding-next-button`, `onboarding-dot`. Onboarding has three pages ("Explore Templates" / "Built-In Components" / "Ship Faster") with a `Get Started` label on the last page — so completing the pager is two `onboarding-next-button` taps then a third.
- **The tab screens have almost no testIDs.** `app/(main)/(tabs)/media.tsx` has only state-branch ids (`media-disabled`, `media-auth-required`, `media-error`); `index.tsx`, `profile.tsx`, and `settings.tsx` have **zero**. Expect to add one stable id per tab screen.
- The four tabs come from `NAV_DESTINATIONS` (`client/features/navigation/navDestinations.ts`): `index`/"Explore", `media`/"Media", `profile`/"Profile", `settings`/"Settings". Tabs render via `NativeTabs` (`expo-router/unstable-native-tabs`), so tab bar items are native — select them by their visible label.
- `/(main)/(demos)/showcase` is the **component** showcase (a long scroll of UI component demos), not a template list. The **screen-template** grid lives on the Explore tab (`app/(main)/(tabs)/index.tsx`), driven by `SCREEN_TEMPLATES` from `client/templates/registry.generated`. A flow that "validates the template registry" must tap a grid card on Explore, not open `/showcase`.
- App identity (scheme, bundle id) comes from `app.identity.js` env defaults — `com.mrmeg.template` / scheme `myapp`. Flows should read the app id from an env var defaulting to `com.mrmeg.template`, not hardcode it.
- Route paths contain parentheses groups (e.g. `app/(main)/(tabs)/`); quote them in any shell commands (AGENTS.md:50).

## Work

1. Add `.maestro/` flows, each independent and runnable against a dev-client or release build with blank env:
   - `launch.yml`: cold launch with `clearState: true`, assert `onboarding-gate` / `onboarding-title` "Explore Templates" renders.
   - `onboarding.yml`: complete the three-page pager via `onboarding-next-button`, assert landing on the Explore tab. Add a second path that uses `onboarding-skip-button` from page 1 (skip and complete both call the same handler).
   - `tabs.yml`: visit Explore / Media / Profile / Settings by tab label, asserting a stable element per screen. Add one `testID` to each of `index.tsx`, `profile.tsx`, `settings.tsx` (root container is enough); `media.tsx` can assert `media-disabled` under blank env. Keep additions minimal.
   - `templates.yml`: from the Explore tab, tap one screen-template grid card and assert the template screen renders (validates the generated registry end-to-end). Pick a card by its `label` from `client/templates/registry.generated`. Optionally also tap the "Component Library" card to reach `/(main)/(demos)/showcase`.
2. Add `"e2e": "maestro test .maestro"` to root `package.json` and a short `docs/e2e.md` (install Maestro, build the app, run). No `docs:llms` regeneration is needed — `scripts/build-llms-full.mjs` reads an explicit `sources` list, not a `docs/` glob, so a new file there is not picked up.
3. Do NOT wire into GitHub Actions in this spec — macOS runners + simulator boot are a cost decision. Leave a note in `docs/e2e.md` about the follow-up.

## Validation

- `bun run typecheck && bun run lint && bun run test:ci` (testID additions must not break snapshot/query-based unit tests).
- Run the suite on an iOS simulator against a local build (`bunx expo run:ios --configuration Release` or the dev client) with `.env` moved aside: all flows pass. The Maestro CLI is already installed (2.8.0), so a blocker here would be the build or simulator, not the tooling — state it exactly in the PR rather than claiming the flows pass.
- Run `launch.yml` twice in a row to prove `clearState` handling makes flows idempotent (it must clear `has-seen-onboarding` so run 2 still lands on onboarding).

## Out of scope

- Android flow runs (flows should avoid iOS-only selectors, but Android verification is a follow-up).
- CI integration.
- Auth-provider flows (require real keys; smoke suite is the no-env path only).

## Open questions

- None.
