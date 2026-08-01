---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Local verify command, git hooks, and package script dedup

## Goal

Add a single `bun run verify` that mirrors CI, wire a fast pre-commit hook, and replace the copy-pasted `ui:*`/`media:*` script fanout with one generic runner — so problems surface locally instead of in CI, and a third workspace package doesn't mean six more duplicated scripts.

## Context

- `.github/workflows/ci.yml` `validate` job runs, in order: `bun install --frozen-lockfile`, `packages:peer-check`, `typecheck`, `lint`, `check:features`, `docs:llms:check`, `test:ci`. A separate `bundle-size` job runs the web export guard. Locally there is no script that chains these; `CONTRIBUTING.md` relies on a manual PR checklist.
- No git hooks exist (no `.husky/`, no `lefthook.yml`).
- Codegen freshness (`gen:templates:check`, `docs:llms:check`) is only enforced in CI — note `ci.yml` currently does NOT run `gen:templates:check`; stale `client/templates/registry.generated.ts` is caught by nothing.
- Root `package.json` duplicates `typecheck`/`test`/`build`/`pack`/`consumer-smoke`/`release` for both `ui:` and `media:` prefixes (12 scripts), each just `bun run --cwd packages/<pkg> <script>` or `node scripts/<per-pkg-script>.mjs`.

## Work

1. Add `"verify": ...` to root `package.json` chaining the CI gates: `packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `docs:llms:check`, then `jest --ci` (no coverage/`--forceExit` needed locally). Keep it a plain `&&` chain or a small `scripts/verify.mjs` that prints per-gate timing — implementer's choice.
2. Add `gen:templates:check` to the CI `validate` job so the generated registry is guarded in CI too.
3. Add lefthook (devDep + `lefthook.yml` + `"prepare": "lefthook install"`): pre-commit runs the cheap gates only (`typecheck`, `lint` on staged files if the eslint setup allows, `gen:templates:check`, `docs:llms:check`); no tests on commit. Do not add a pre-push hook that runs the full suite by default — keep push fast; `verify` is the opt-in full pass.
4. Replace the 12 `ui:*`/`media:*` scripts with a generic `"pkg": "node scripts/run-package-script.mjs"` runner used as `bun run pkg <ui|media> <typecheck|test|build|pack|consumer-smoke|release>`, mapping `pack`→`publish:dry-run` and `consumer-smoke`/`release` to the existing per-package scripts in `scripts/`. Keep `ui:test` and `media:test` as thin aliases only if `.github/workflows/*.yml` or docs reference them — grep and update all references (`publish-ui.yml`, `publish-media.yml`, `package-compatibility.yml`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/`).
5. Update `CONTRIBUTING.md` checklist to "run `bun run verify`".

## Validation

- `bun run verify` passes on a clean checkout with no `.env`.
- `bun run pkg ui typecheck` and `bun run pkg media test` behave identically to the old scripts.
- Make a commit touching a template `meta.ts` without regenerating the registry: pre-commit hook must fail; after `bun run gen:templates`, it passes.
- CI on the PR stays green (proves workflow references were updated).

## Out of scope

- Adding new lint rules or enabling the commented-out jest coverage thresholds.
- E2E hooks (separate spec: `maestro-e2e-smoke.md`).

## Open questions

- None.
