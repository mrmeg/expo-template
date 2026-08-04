---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/28
---

# Local verify command, git hooks, and package script dedup

## Goal

Add a single `bun run verify` that mirrors CI, wire a fast pre-commit hook, and put one generic runner behind the copy-pasted `ui:*`/`media:*` script fanout — so problems surface locally instead of in CI, and a third workspace package doesn't mean six more duplicated scripts.

## Context

- `.github/workflows/ci.yml` `validate` job runs, in order: `bun install --frozen-lockfile`, `packages:peer-check`, `typecheck`, `lint`, `check:features`, `docs:llms:check`, `test:ci` (step names: "Check package peer compatibility", "Type check", "Lint", "Feature isolation check", "LLM docs freshness check", "Test"). A separate `bundle-size` job runs `build` then `bundle-size`. Locally there is no script that chains these; `CONTRIBUTING.md` relies on a manual PR checklist (lines 26–36).
- No git hooks exist (no `.husky/`, no `lefthook.yml`, no `core.hooksPath`, no non-sample files in `.git/hooks`).
- `ci.yml` does NOT run `gen:templates:check`; stale `client/templates/registry.generated.ts` is caught by nothing. The script exists (`npx tsx scripts/generate-template-registry.ts --check`) and exits 1 with a "run `bun run gen:templates` and commit" message.
- Root `package.json` lines 32–43 duplicate `typecheck`/`test`/`build`/`pack`/`consumer-smoke`/`release` for both `ui:` and `media:` prefixes (12 scripts), each just `bun run --cwd packages/<pkg> <script>` or `node scripts/<per-pkg-script>.mjs`. `pack` maps to the package's own `publish:dry-run`; `consumer-smoke`/`release` map to `scripts/check-{ui,media}-package-consumer.mjs` / `scripts/release-{ui,media}-package.mjs`.
- `lint` is `expo lint` (flat config in `eslint.config.mjs`). Confirm `expo lint <paths>` forwards file args before building a staged-files hook; if it doesn't, run repo-wide `lint` in the hook instead.

## Work

1. Add `"verify": ...` to root `package.json` chaining the CI gates: `packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `docs:llms:check`, then `jest --ci` (no coverage/`--forceExit` needed locally). Keep it a plain `&&` chain or a small `scripts/verify.mjs` that prints per-gate timing — implementer's choice.
2. Add a `gen:templates:check` step to the CI `validate` job (before "LLM docs freshness check") so the generated registry is guarded in CI too.
3. Add lefthook (devDep + `lefthook.yml` + `"prepare": "lefthook install"`): pre-commit runs the cheap gates only (`typecheck`, `lint`, `gen:templates:check`, `docs:llms:check`); no tests on commit. Do not add a pre-push hook that runs the full suite by default — keep push fast; `verify` is the opt-in full pass.
4. Add a generic `"pkg": "node scripts/run-package-script.mjs"` runner used as `bun run pkg <ui|media> <typecheck|test|build|pack|consumer-smoke|release>` (mapping per Context). **Keep all 12 `ui:*`/`media:*` scripts as thin aliases** — they are load-bearing:
   - `scripts/release-ui-package.mjs` and `scripts/release-media-package.mjs` shell out to them (`run("bun", ["run", "ui:typecheck"])` etc., ui lines 141–145, media lines 139–143) and print them in `--help` text.
   - `.github/workflows/publish-ui.yml` (lines 120–136) and `publish-media.yml` (lines 143–159) run them as steps. (`package-compatibility.yml` does **not** — it only uses `packages:peer-check` and `packages:compatibility`.)
   - They appear in published package docs: `packages/ui/README.md`, `packages/ui/llms-full.md`, `packages/media/README.md`, `packages/media/llms-full.md`, `packages/media/LLM_USAGE.md`, plus root `README.md` (280–291) and `docs/template-modernization-guide.md` (165–168).
   So this step is additive: introduce `pkg` as the preferred entry point, keep the aliases delegating to it, and leave workflow/doc references alone. Do not edit `packages/*/llms-full.md` or `docs/template-modernization-guide.md` (the latter is an llms source — editing it forces a `bun run docs:llms` regen).
5. Update the `CONTRIBUTING.md` PR checklist (lines 28–31) to a single "`bun run verify` passes" item, keeping the manual web/native/showcase/secrets items.

## Validation

- `bun run verify` passes on a clean checkout with no `.env`.
- `bun run pkg ui typecheck` and `bun run pkg media test` behave identically to `bun run ui:typecheck` / `bun run media:test`, and the aliases still work (so `scripts/release-*-package.mjs` and the publish workflows are unaffected).
- Add a new template folder with a `meta.ts` and commit without regenerating: pre-commit must fail; after `bun run gen:templates`, it passes.
- Note: `ci.yml` triggers only on `pull_request`/`push` to `main`, so a PR into `dev` will NOT run it. Validate the edited workflow by reasoning about the YAML plus running each new step's script locally — do not claim "CI green" from a `dev` PR.

## Out of scope

- Adding new lint rules or enabling the commented-out jest coverage thresholds.
- E2E hooks (separate spec: `maestro-e2e-smoke.md`).

## Open questions

- None.
