---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/32
---

# Enable React Compiler

## Goal

Turn on React Compiler so components get automatic memoization. `packages/ui` leans on manual `useMemo`/`useCallback` but nothing is `React.memo`-wrapped, and template screens re-render freely; the compiler covers both without hand-written memo hygiene in every derived project.

## Context

- `app.config.ts:153-155` `experiments` currently contains only `typedRoutes: true` — no `reactCompiler` key, so the compiler is off. There is no `babel.config.js`, `.babelrc`, or `babel` key anywhere in the repo; the flag is the only switch.
- `babel-preset-expo` (SDK 57) already depends on `babel-plugin-react-compiler ^1.0.0` and plumbs the option through (`node_modules/babel-preset-expo/build/index.js:122`); no new babel dependency or custom `babel.config.js` change should be needed — enabling is the config flag.
- React 19.2.3 — no `react-compiler-runtime` shim needed (19+ has the runtime built in).
- Workspace packages: `@mrmeg/expo-ui`/`@mrmeg/expo-media` are consumed from `dist` by default (compiled per-package via tsc), so the compiler will NOT process them unless `EXPO_UI_LOCAL_SOURCE=1` maps `@mrmeg/expo-ui` to `packages/ui/src` (`metro.config.js:10`). `babel-preset-expo/build/configs/expo.js:134-158` confirms this: the compiler is skipped for anything matching `isNodeModule`. Compiler wins land in app/template code either way; document this limit.
- The same code skips the compiler when `isServerEnv` — **SSR renders are not compiled**, so web has a client/server transform asymmetry. That's the main hydration-risk surface to spot-check. Opt-out directives are `'use no memo'`, `'use no forget'`, and `'widget'`; `panicThreshold` is `'NONE'` in production builds (compile failures degrade silently rather than erroring).
- Jest uses `jest-expo` preset which routes through babel-preset-expo — the flag may change test-time transforms too; the full suite is the guard.
- Rules-of-React violations surface as components the compiler skips (or, worse, behavior changes). **No hooks/compiler lint rules exist today:** `eslint-config-expo` is not installed, and neither is `eslint-plugin-react-hooks`. `eslint.config.mjs` extends only `eslint:recommended`, `plugin:react/recommended`, and `plugin:@typescript-eslint/recommended` via FlatCompat. So step 1 must add a dependency, not just a rule.
- Current lint baseline (pre-change) is `10 problems (0 errors, 10 warnings)` — `no-explicit-any`/`no-unused-vars` in `app/(main)/developer.tsx`, `showcase/index.tsx`, `(tabs)/index.tsx`, `(tabs)/settings.tsx`. Anything beyond that is new.

## Work

1. `bun add -d eslint-plugin-react-hooks@^7.1.1` (peer range allows the repo's `eslint ^10.7.0`; v7 folds the react-compiler rules into `configs.flat['recommended-latest']` — use that, not the stale standalone `eslint-plugin-react-compiler`). Wire it into `eslint.config.mjs` alongside the existing FlatCompat blocks, run `bun run lint`, and fix violations it reports in `client/`, `app/`, and `packages/*/src` — fixes must be behavior-preserving. Warnings beyond the 10-warning baseline above are the new signal.
2. Set `experiments: { typedRoutes: true, reactCompiler: true }` in `app.config.ts`.
3. Confirm the compiler is actually active: `bunx expo start` prints `React Compiler enabled` (`instantiateMetro.js:263-264`; suppressed when logs are reduced), or inspect a transformed module for `_c(` memo-cache calls. Record which check was used in the PR.
4. Optionally delete now-redundant manual `useMemo`/`useCallback` ONLY where trivially safe — prefer leaving existing code untouched in this pass; note the cleanup as a follow-up.

## Validation

- `bun run typecheck && bun run lint && bun run test:ci && bun run gen:templates:check && bun run docs:llms:check` (there is no `verify` script).
- `bun run build && bun run bundle-size` — the guard reads `dist/client`, so build first; compiler output adds some code and must stay within the 10% threshold.
- Manual on iOS simulator and web: exercise the showcase (chat send, list scroll, tabs, bottom sheet, theme toggle dark/light) — no behavior changes, no new console errors. Per AGENTS.md, SSR pages must be spot-checked with real server HTML (`bun run build && bun run start`, then curl) since the server env is uncompiled while the client is — hydration warnings are the thing to watch for. Note the onboarding gate masks `(main)` routes server-side; see the short-circuit note in `docs/ssr-hydration.md` (~line 264).

## Out of scope

- Removing the manual memoization across `packages/ui` (follow-up once compiler has soaked).
- Compiling the workspace packages' published `dist` output with the compiler.

## Open questions

- None.
