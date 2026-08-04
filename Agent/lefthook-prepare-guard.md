---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Guard the lefthook prepare script outside git repos

## Goal

`bun install` currently hard-fails in a non-git directory because `"prepare": "lefthook install"` exits 128 (`fatal: not a git repository`). A user who downloads/unzips the template (or any tarball consumer) can't install dependencies before `git init`. Make `prepare` a no-op outside a git work tree while keeping hook installation automatic inside one.

## Context

- Verified during PR #28: `lefthook install` exits 128 outside a repo and bun surfaces it as `error: prepare script from "template" exited with 1`. The PR shipped without a guard, flagged for this follow-up.
- `package.json` has `"prepare": "lefthook install"`; `lefthook.yml` defines the pre-commit gates; `scripts/init.ts` (`bun run init`) targets fresh copies and would hit this too if run before `git init`.
- The guard must not swallow real lefthook failures inside a git repo — a plain `|| true` hides broken hook installs from contributors.

## Work

1. Change `prepare` to run lefthook only when inside a git work tree, e.g. `git rev-parse --is-inside-work-tree >/dev/null 2>&1 && lefthook install || exit 0` — or an equivalent tiny `scripts/prepare.mjs` if the one-liner's cross-shell behavior on bun is unreliable (bun runs lifecycle scripts through a shell; verify the one-liner works via `bun install` before choosing the script route). Inside a repo, a real `lefthook install` failure must still fail loudly — structure the condition so only the not-a-repo case is silenced.
2. Document the behavior in `CONTRIBUTING.md`'s Git Hooks section (one sentence).

## Validation

- In the repo: `bun install` still prints lefthook's `sync hooks` output and `.git/hooks/pre-commit` exists after a fresh `rm .git/hooks/pre-commit && bun install`.
- Outside a repo: `rsync` the worktree (excluding `.git`, `node_modules`) to a temp dir → `bun install` succeeds (exit 0).
- Negative control inside the repo: temporarily break lefthook resolution (e.g. `PATH` without node_modules/.bin using the raw command) is NOT required — instead assert the guard's structure: only the `git rev-parse` failure branch exits 0.
- `bun run verify` passes.

## Out of scope

- Any change to the pre-commit gate list or lefthook.yml.
- Wiring `bun run init` to run `git init` (separate decision).

## Open questions

- None.
