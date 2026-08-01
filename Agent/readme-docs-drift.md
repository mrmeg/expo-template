---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Fix README drift and add a version-drift guard

## Goal

Bring `README.md` in line with the actual stack (SDK 57 / RN 0.86, dual auth providers) and add a cheap check so version claims can't silently drift again. The README is the first thing humans and agents read when starting a project from this template; stale claims cost real debugging time.

## Context

Verified drift in `README.md` against `package.json` (expo `~57.0.8`, react-native `0.86.0`):

- Line 11: claims "Expo SDK 56 / React 19.2 / RN 0.85".
- Line 354: repeats "Expo SDK 56, React 19.2, React Native 0.85".
- Lines 18, 157, 223, 358: describe auth as "AWS Amplify / Cognito" only, but the code selects between Clerk and Cognito at runtime via `client/features/auth/provider/AuthProviderGate.tsx` (Clerk lazy-required in `clerkClient.ts`, server verification in `server/api/shared/clerkTokenVerifier.ts`, keys documented in `.env.example`).
- `docs/` may repeat the same claims — grep `docs/ CONTRIBUTING.md AGENTS.md` for `SDK 56`, `0.85`, and auth-provider statements and fix matches.
- `llms-full.txt`/`llms-examples.txt` are generated from a source-doc list by `scripts/build-llms-full.mjs`; if any walked doc changes, regenerate with `bun run docs:llms`.

## Work

1. Update the stack claims to SDK 57 / RN 0.86 / RNW 0.21 — but source them from `package.json` wording like "SDK 57 (see package.json for exact pins)" where practical, so the guard below has less surface.
2. Rewrite the auth sections to describe the provider gate: Clerk or Cognito, selected by which env keys are present, both optional/fail-closed.
3. Add `scripts/check-readme-versions.mjs`: asserts the expo major and react-native minor named in `README.md` match `package.json`; wire it as `docs:versions:check` into CI's `validate` job (and into `verify` if `local-verify-and-git-hooks.md` has landed).
4. Run `bun run docs:llms` and commit regenerated outputs if changed.

## Validation

- `grep -n "SDK 56\|0\.85" README.md docs/*.md` returns nothing.
- `node scripts/check-readme-versions.mjs` passes; temporarily editing README back to "SDK 56" makes it fail.
- `bun run docs:llms:check` passes.

## Out of scope

- `docs/migration-guide.md` historical content (it legitimately describes the 55→56 upgrade).
- Restructuring the README.

## Open questions

- None.
