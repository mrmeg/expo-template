---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Enable React Compiler

## Goal

Turn on React Compiler so components get automatic memoization. `packages/ui` leans on manual `useMemo`/`useCallback` but nothing is `React.memo`-wrapped, and template screens re-render freely; the compiler covers both without hand-written memo hygiene in every derived project.

## Context

- `app.config.ts` `experiments` currently contains only `typedRoutes: true` — no `reactCompiler` key, so the compiler is off.
- `babel-preset-expo` (SDK 57) already depends on `babel-plugin-react-compiler ^1.0.0` and plumbs the option through (`node_modules/babel-preset-expo/build/index.js:122`); no new babel dependency or custom `babel.config.js` change should be needed — enabling is the config flag.
- React 19.2.3 — no `react-compiler-runtime` shim needed (19+ has the runtime built in).
- Workspace packages: `@mrmeg/expo-ui`/`@mrmeg/expo-media` are consumed from `dist` by default (compiled per-package via tsc), so the compiler will NOT process them unless `EXPO_UI_LOCAL_SOURCE=1` maps `@mrmeg/expo-ui` to `packages/ui/src` (metro.config.js). Compiler wins land in app/template code either way; document this limit.
- Jest uses `jest-expo` preset which routes through babel-preset-expo — the flag may change test-time transforms too; the full suite is the guard.
- Rules-of-React violations surface as components the compiler skips (or, worse, behavior changes). ESLint: the repo uses `eslint-config-expo` via `expo lint` — check whether the react-compiler lint rule (now part of `eslint-plugin-react-hooks` v6 / `eslint-plugin-react-compiler`) is already active in `eslint.config.mjs`; add it if not so violations are visible before enabling.

## Work

1. Add the compiler lint rule to `eslint.config.mjs` (verify the current recommended package for the installed ESLint 10 setup), run `bun run lint`, and fix any violations it reports in `client/`, `app/`, and `packages/*/src` — fixes must be behavior-preserving.
2. Set `experiments: { typedRoutes: true, reactCompiler: true }` in `app.config.ts`.
3. Confirm the compiler is actually active: `bunx expo start` logs a React Compiler notice, or inspect a transformed module (e.g. via `EXPO_DEBUG=1` bundle output) for `_c(` memo-cache calls. Record which check was used in the PR.
4. Optionally delete now-redundant manual `useMemo`/`useCallback` ONLY where trivially safe — prefer leaving existing code untouched in this pass; note the cleanup as a follow-up.

## Validation

- `bun run verify` if available, else: `typecheck`, `lint`, `test:ci`, `gen:templates:check`, `docs:llms:check`.
- `bun run bundle-size` — compiler output adds some code; must stay within the 10% guard.
- Manual on iOS simulator and web: exercise the showcase (chat send, list scroll, tabs, bottom sheet, theme toggle dark/light) — no behavior changes, no new console errors. Per AGENTS.md, SSR pages must be spot-checked with real server HTML (`bun run start` + curl a showcase route) since transform changes can affect hydration.

## Out of scope

- Removing the manual memoization across `packages/ui` (follow-up once compiler has soaked).
- Compiling the workspace packages' published `dist` output with the compiler.

## Open questions

- None.
