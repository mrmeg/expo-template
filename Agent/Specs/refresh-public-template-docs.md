# Spec: Refresh Public Template Docs

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Update public-facing setup and contribution docs so they match the current template architecture, commands, paths, package manager, theme tokens, and feature list. The README should be reliable for a new project owner cloning this repo.

## Why
Docs are part of the template product. Stale commands and paths cause adopters to waste time before they reach app-specific work.

## Current State
`README.md` still uses npm install/start commands even though the Agent docs and lockfile establish Bun as the package manager. It references old paths such as `/client/i18n`, `/client/services/api`, `/client/stores`, and theme tokens like `bgPrimary`/`textPrimary` that no longer match `theme.colors.background`/`foreground`. `CONTRIBUTING.md` says coverage targets `client/**`, while `jest.config.js` now also collects API, server, and shared coverage.

## Changes
1. Rewrite setup commands around the current Bun workflow.
   - Use `bun install`.
   - Document `bun run web`, `bun run start-local`, `bun run typecheck`, `bun run lint`, and `bun run test:ci` accurately.

2. Refresh architecture and path examples.
   - Point i18n to `client/features/i18n`.
   - Point API utilities to `client/lib/api`.
   - Point stores to `client/state` and feature stores under `client/features/*/stores`.
   - Mention `client/lib/form` for form primitives.

3. Refresh code snippets.
   - Use current theme token names.
   - Use current import paths.
   - Remove references to nonexistent APIs such as `api.setAuthToken` if not present.

4. Refresh feature descriptions.
   - Keep billing, auth optionality, media, app shell, and generator docs consistent with Agent docs.
   - Avoid claiming unsupported fonts or icon libraries.

5. Update contribution notes.
   - Align testing coverage description with `jest.config.js`.
   - Replace references to ignored or removed docs such as `CLAUDE.md` with Agent docs.

## Acceptance Criteria
1. README setup works from a fresh clone using the committed package manager.
2. All documented paths exist.
3. All code snippets use exported APIs and current theme tokens.
4. `CONTRIBUTING.md` no longer contradicts package manager, docs, or test coverage behavior.
5. Agent docs remain the authoritative deeper architecture reference.

## Constraints
- Do not turn the README into exhaustive internal documentation.
- Keep docs useful for template adopters, not only framework agents.
- Do not change code behavior except where docs uncover a small typo that must be fixed to keep examples accurate.

## Out of Scope
- Creating a full documentation website.
- Writing per-component API docs.
- Rebranding the template.

## Files Likely Affected
Docs:
- `README.md`
- `CONTRIBUTING.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/API.md`
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/PERFORMANCE.md`

Client snippets may reference:
- `client/hooks/useTheme.ts`
- `client/lib/api/*`
- `client/features/i18n/*`

## Edge Cases
- Commands should distinguish Expo dev server from production Express server.
- Billing should remain documented as disabled by default.
- Auth should remain documented as optional.
- Examples should not require private env values.

## Risks
Docs can drift again quickly. Keep the update tied to real source paths and avoid duplicating long architecture sections that already live in Agent docs.
