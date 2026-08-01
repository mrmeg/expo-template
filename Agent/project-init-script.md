---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Interactive project init script

## Goal

One command (`bun run init`) that turns a fresh clone of the template into a named project: writes the identity env vars, selects the auth provider, optionally prunes unused screen templates, and re-runs prebuild. Today this is ~30 minutes of hand-editing a 76-line `.env.example` plus manual cleanup.

## Context

- Identity is already centralized: `app.identity.js` reads six `EXPO_PUBLIC_APP_*` vars (name, slug, scheme, iOS bundle id, Android package, plus one more — read the file for the exact set) and `app.config.ts` validates them at config load. The committed `ios/`/`android/` dirs carry the template's identity until `expo prebuild` is re-run.
- `.env.example` (76 lines) documents Clerk, Cognito, Stripe, Sentry, R2/media keys; every optional feature fails closed on blank env (AGENTS.md requirement).
- Auth provider is selected at runtime by `client/features/auth/provider/AuthProviderGate.tsx` (clerk vs cognito vs disabled), driven by which env keys are present.
- Screen templates live in `client/templates/<id>/` with `meta.ts`; `client/templates/registry.generated.ts` is codegen via `bun run gen:templates` (never hand-edit). Template tests live in `client/templates/__tests__/screens.test.tsx`.
- Existing scaffolding CLI `scripts/generate.ts` (unit-tested in `scripts/__tests__/generate.test.ts`) shows the repo's prompt/CLI conventions — follow them.

## Work

1. Create `scripts/init.ts` (wired as `"init"` in root `package.json`) that:
   - Prompts for app name, slug, URL scheme, iOS bundle id, Android package (deriving sensible defaults from the name), and writes them into a new `.env` copied from `.env.example`. Never overwrite an existing `.env` without an explicit `--force`.
   - Prompts for auth provider (Clerk / Cognito / none) and comments out the irrelevant provider's env block in the generated `.env`.
   - Optionally prompts for which screen templates to keep; deletes the unselected `client/templates/<id>/` dirs, removes their entries from `client/templates/__tests__/screens.test.tsx` and any showcase route references, then runs `bun run gen:templates`.
   - Offers to run `bunx expo prebuild --clean` (skippable; print the command if skipped).
   - Supports non-interactive use: `bun run init --name X --slug y ... --templates chat,list --auth clerk --yes` so agents can drive it.
2. Unit-test the pure parts (default derivation, env rewriting, template pruning plan) in `scripts/__tests__/init.test.ts`, mirroring `generate.test.ts` style. Don't test the interactive prompt loop or prebuild invocation.
3. Document the flow at the top of `README.md` quick-start (coordinate with `readme-docs-drift.md` if both are in flight — see Merge plan).

## Validation

- `bun run typecheck && bun run lint && bun run test:ci`
- In a scratch copy of the repo: run `bun run init` non-interactively with a fake identity and 2 kept templates; then `bun run gen:templates:check` passes, `bun run test:ci` passes, and `bunx expo config --type public | grep <slug>` shows the new identity.
- Fresh clone with no `.env` (init skipped) must still work — init must not become a required step.

## Out of scope

- Packaging as `npx create-expo --template` / publishing a create-* CLI.
- Renaming inside committed `ios/`/`android/` dirs directly (prebuild owns that).
- EAS project setup (separate spec: `eas-build-config.md`).

## Merge plan

Touches `README.md` quick-start; `readme-docs-drift.md` rewrites README claims. Land `readme-docs-drift.md` first (it's small), then rebase this.

## Open questions

- None.
