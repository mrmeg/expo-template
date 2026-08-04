---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/27
---

# Interactive project init script

## Goal

One command (`bun run init`) that turns a fresh clone of the template into a named project: writes the five identity env vars, selects the auth provider, optionally prunes unused screen templates, and re-runs prebuild. Today this is hand-editing a 76-line `.env.example` plus manual cleanup across 17 template folders and their route re-exports.

## Context

- Identity is centralized in `app.identity.js` → exactly **five** vars, all `.env.example` lines 9–13:
  `EXPO_PUBLIC_APP_NAME`, `EXPO_PUBLIC_APP_SLUG`, `EXPO_PUBLIC_APP_SCHEME`, `EXPO_PUBLIC_APP_IOS_BUNDLE_ID`, `EXPO_PUBLIC_APP_ANDROID_PACKAGE`.
  Blank/whitespace falls back to defaults (`template` / `template` / `myapp` / `com.mrmeg.template` / `com.mrmeg.template`). `getAppIdentity()` validates and **throws** on malformed values — reuse its regexes rather than re-deriving: slug `^[a-z0-9][a-z0-9-]*$`, scheme `^[a-z][a-z0-9+\-.]*$`, bundle id / package reverse-DNS `^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$`. `name` is unvalidated. `app.config.ts` calls `getAppIdentity()` at config load. Note `EXPO_PUBLIC_APP_URL` (line 64) is a *billing* var, not identity — leave it alone.
- The committed `ios/`/`android/` dirs carry the template's identity until `expo prebuild` is re-run.
- `.env.example` (76 lines) documents Clerk, Cognito, Stripe, Sentry, R2/media keys; every optional feature fails closed on blank env (AGENTS.md requirement). All values are `KEY=""` — the rewriter can be a simple line-keyed replace.
- Auth provider is resolved by `getAuthProvider()` in `client/features/auth/provider/index.ts`: Clerk if `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set, Cognito if both `EXPO_PUBLIC_USER_POOL_ID` + `EXPO_PUBLIC_USER_POOL_CLIENT_ID` are set, Clerk wins when both, `EXPO_PUBLIC_AUTH_PROVIDER` ("clerk" | "cognito") forces one, else disabled. Since blank keys already mean "off", the auth prompt only needs to set `EXPO_PUBLIC_AUTH_PROVIDER` and leave the unused block blank — no commenting-out required.
- Screen templates: 17 folders under `client/templates/<id>/`, each with `Screen.tsx`, `demo.tsx`, `meta.ts`, `README.md`. `registry.generated.ts` is codegen from folders containing a `meta.ts` via `bun run gen:templates` (never hand-edit); `client/showcase/registry.ts` just re-exports `SCREEN_TEMPLATES`, so no showcase edit is needed when pruning.
- Each template also has a route re-export at `app/(main)/(demos)/screen-<id>.tsx` (exception: `detail-hero` → `app/(main)/(demos)/detail-hero.tsx`, matching its `meta.route`). Pruning must delete the matching route file, derived from `meta.route`, not from the id.
- `client/templates/__tests__/screens.test.tsx` (259 lines) only imports 7 of the 17 templates: error, faq, hero, list, stats, testimonials, welcome. Pruning must remove the `import` + `describe` block for a pruned template only when it is one of those 7.
- Existing scaffolding CLI `scripts/generate.ts` (unit-tested in `scripts/__tests__/generate.test.ts`) shows the repo's conventions: `process.argv` parsing, `getPlannedFiles()`-style pure helpers exported for tests, `main()` guarded by `require.main === module`, ANSI `colors`/`log` helper. It is **not** interactive and there is no prompt library installed — implement prompts with `node:readline/promises`; do not add a dependency.

## Work

1. Create `scripts/init.ts` (wired as `"init": "npx tsx scripts/init.ts"` in root `package.json`, matching `generate`/`gen:templates`) that:
   - Prompts for the five identity values, deriving defaults from the name (slug = kebab-case, scheme = slug, bundle id / package = `com.<sanitized-name>`), and validates each with `getAppIdentity()`'s rules before writing. Writes them into a new `.env` copied from `.env.example`. Never overwrite an existing `.env` without an explicit `--force`.
   - Prompts for auth provider (Clerk / Cognito / none) and sets `EXPO_PUBLIC_AUTH_PROVIDER` accordingly (empty for none), leaving the unused provider's keys blank.
   - Optionally prompts for which screen templates to keep; for each pruned id deletes `client/templates/<id>/` and its route file (resolved from `meta.route`), drops its import + `describe` block from `client/templates/__tests__/screens.test.tsx` when present, then runs `bun run gen:templates`.
   - Offers to run `bunx expo prebuild --clean` (skippable; print the command if skipped).
   - Supports non-interactive use: `bun run init --name X --slug y ... --templates chat,list --auth clerk --yes` so agents can drive it.
2. Unit-test the pure parts (default derivation, env rewriting, template pruning plan incl. route-file resolution) in `scripts/__tests__/init.test.ts`, mirroring `generate.test.ts` style — export the helpers and guard `main()` with `require.main === module`. Don't test the interactive prompt loop or prebuild invocation.
3. Document the flow at the top of `README.md` quick-start (coordinate with `readme-docs-drift.md` if both are in flight — see Merge plan).

## Validation

- `bun run typecheck && bun run lint && bun run test:ci`
- In a **scratch copy** of the repo (never prune templates in the real working tree): run `bun run init` non-interactively with a fake identity and 2 kept templates; then `bun run gen:templates:check` passes, `bun run test:ci` passes, and `bunx expo config --type public | grep <slug>` shows the new identity.
- Verify no dangling references remain after pruning: `bun run check:features` and `bun run docs:llms:check` still pass in the scratch copy. (`scripts/build-llms-full.mjs` walks `client/templates` and `app/(main)/(demos)`, so pruning changes `llms-examples.txt` — in the scratch copy run `bun run docs:llms` before `docs:llms:check`. The committed repo must be left untouched.)
- Fresh clone with no `.env` (init skipped) must still work — init must not become a required step.

## Out of scope

- Packaging as `npx create-expo --template` / publishing a create-* CLI.
- Renaming inside committed `ios/`/`android/` dirs directly (prebuild owns that).
- EAS project setup (separate spec: `eas-build-config.md`).

## Merge plan

Touches `README.md` quick-start; `readme-docs-drift.md` rewrites README claims (including line 123, in the same Generator CLI region). Land `readme-docs-drift.md` first (it's small), then rebase this.

## Open questions

- None.
