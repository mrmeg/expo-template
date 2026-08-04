---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Guard the lefthook prepare script outside git repos

## Goal

`bun install` currently hard-fails in a non-git directory because `"prepare": "lefthook install"` exits 128 (`fatal: not a git repository`). A user who downloads/unzips the template (or any tarball consumer) can't install dependencies before `git init`. Make `prepare` a no-op outside a git work tree while keeping hook installation automatic inside one.

## Context

- Verified during PR #28 and re-confirmed here: `lefthook install` outside a git repo prints `fatal: not a git repository` and exits 128; bun surfaces it as `error: prepare script from "template" exited with 1`. The PR shipped without a guard, flagged for this follow-up.
- `package.json:54` is `"prepare": "lefthook install"` (lefthook `^2.1.10`, devDep, at `node_modules/.bin/lefthook`). `lefthook.yml` defines four parallel `pre-commit` jobs (`typecheck`, `lint`, `gen:templates:check`, `docs:llms:check`) and no pre-push. `CONTRIBUTING.md` has a `## Git Hooks` section at lines 26-36 describing exactly that. `scripts/init.ts` (`bun run init`) targets fresh copies but does not itself install deps.
- The guard must not swallow real lefthook failures inside a git repo — a plain `|| true` hides broken hook installs from contributors.
- **Shell semantics resolved empirically** (bun 1.3.14 runs lifecycle scripts through its own POSIX-ish shell). The spec's original draft one-liner `git rev-parse … && lefthook install || exit 0` is **wrong**: `&& X || exit 0` also swallows a failing `X`, so a broken `lefthook install` inside a repo silently exits 0. Tested four forms; only the `||`-first + `;` sequencing form has correct semantics:
  - `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0; lefthook install` → outside a repo exit 0 (lefthook never runs); inside a repo, a lefthook failure propagates (verified: bun reports `error: script … exited with code 1`).
  - Both `&& lefthook install || exit 0` variants masked the inner failure. Use the `||`-first form; no `scripts/prepare.mjs` needed.

## Work

1. Set `package.json`'s `prepare` to exactly:
   `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0; lefthook install`
2. Add one sentence to `CONTRIBUTING.md`'s `## Git Hooks` section (lines 26-36): outside a git work tree the `prepare` script exits 0 without installing hooks, so `bun install` works on an unzipped copy before `git init`; run `bunx lefthook install` (already documented at line 36) after initializing the repo.

## Validation

- In the repo: `rm .git/hooks/pre-commit && bun install` re-prints lefthook's sync output and recreates `.git/hooks/pre-commit`.
- Outside a repo: copy the worktree (excluding `.git` and `node_modules`) to a temp dir → `bun install` exits 0. Cheaper equivalent already proven for the one-liner itself: in a temp dir with no `.git`, a `package.json` whose `prepare` is the guard form runs to exit 0 and never reaches the second command.
- Negative control inside a repo: with the guard form, `git rev-parse … || exit 0; false` exits 1 (bun reports the script failure) — so a real `lefthook install` failure is not masked. The rejected `&& … || exit 0` forms exit 0 here.
- `bun run verify` passes (unaffected by this change; `prepare` is not one of its gates).

## Out of scope

- Any change to the pre-commit gate list or lefthook.yml.
- Wiring `bun run init` to run `git init` (separate decision). Note: `scripts/init.ts` never shells out to `bun install` or `lefthook` (it only runs `gen:templates` and optionally `expo prebuild`), so it needs no change here — the earlier concern that init would hit this does not apply.
- A `scripts/prepare.mjs` wrapper — the one-liner's semantics are confirmed correct on bun.

## Open questions

- None.
