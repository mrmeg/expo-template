---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Keep react-native-keyboard-controller (and Reanimated) out of the web bundle

## Goal
Remove ~452 kB uncompressed (reanimated 425.7 kB + worklets 7.9 kB + keyboard-controller 18.2 kB) from the web entry bundle. Nothing in app or package source uses Reanimated on web; it enters solely because `react-native-keyboard-controller`'s `lib/module/hooks/index.js` does `import { useEvent, useHandler } from "react-native-reanimated"`, and three `packages/ui` components import keyboard-controller statically.

## Context
Verified against `dist/client/_expo/static/js/web/entry-c5fb9205….js` module graph (2026-08-11):

- Importers of `react-native-keyboard-controller` in `packages/ui/src/components/`:
  - `KeyboardAvoidingView.tsx:9-11` — imports `KeyboardAvoidingView as NativeKeyboardAvoidingView`; already has a `Platform.OS === "web"` runtime branch that renders a plain `View`, but the static import still bundles the package.
  - `DismissKeyboard.tsx:11-15` — imports `KeyboardController, useKeyboardContext, useKeyboardState`; the hooks are only invoked inside `NativeDismissKeyboard`, which is never mounted on web (`DismissKeyboard` returns `DismissKeyboardLayout` directly on web).
  - `BottomSheet.tsx:16` — imports `KeyboardController`; `KeyboardController.dismiss()` is called only in `SheetKeyboardDismissOverlay`'s `onPressIn`, and that component returns `null` on web.
  - `keyboardFocusRegistry.ts:2` — **type-only** import (`FocusedInputLayoutChangedEvent`); does not bundle, leave as is.
- `UIProvider.tsx` mounts `KeyboardAvoidingView` at the app root, so this lands in entry, not a route chunk.
- `packages/ui` has no `.native`/`.web` platform files today. Build is `tsc -p tsconfig.build.json` to `dist/` preserving per-file structure, so `.native.ts` compiles to `.native.js` in `dist/` and Metro platform resolution works for both local source (`EXPO_UI_LOCAL_SOURCE=1`) and published-package consumers.
- The app already uses this exact pattern in `client/features/keyboard/platform/` (`index.ts` web, `index.native.ts` native).
- `packages/ui` has a `check:forbidden-imports` build step — the new files must pass it.

## Work
1. Add an indirection module in `packages/ui/src/lib/` (or `src/components/`, match package convention):
   - `keyboardController.native.ts` — re-export `KeyboardController`, `useKeyboardState`, `useKeyboardContext`, and `KeyboardAvoidingView as NativeKeyboardAvoidingView` from `react-native-keyboard-controller`.
   - `keyboardController.ts` (web default) — same exported names as inert stubs: `KeyboardController.dismiss()` no-op; `useKeyboardState(selector)` returns the selector applied to a static "keyboard hidden" state; `useKeyboardContext()` returns a shape satisfying the `{ layout: { value } }` access in `DismissKeyboard.tsx:48-56`; `NativeKeyboardAvoidingView` = plain `View` passthrough. Keep hook stubs rules-of-hooks-safe (call `useMemo`/nothing conditional).
2. Point the three components' imports at the indirection module instead of `react-native-keyboard-controller`. Do not change public component APIs or the existing `Platform.OS === "web"` runtime branches.
3. Do not remove `react-native-keyboard-controller` from package peer/dev deps — native still uses it.
4. Rebaseline: `bun run build && node scripts/check-bundle-size.js --update`, commit `scripts/bundle-baseline.json`.

## Validation
- `bun run ui:typecheck && bun run ui:test` (packages/ui build must also pass: `bun run ui:build`, which runs the forbidden-imports check).
- `bun run typecheck && bun run test:ci`.
- `bun run build`, then confirm no web chunk contains Reanimated:
  `grep -rlc "react-native-reanimated" dist/client/_expo/static/js/web/*.js.map` must match nothing (today the entry map matches).
- `node scripts/check-bundle-size.js` passes with the new baseline.
- Native behavior needs no re-verification beyond unit tests: the `.native.ts` file re-exports the same symbols, so native module resolution is unchanged.

## Out of scope
- Route-level code splitting and Clerk lazy-loading (separate specs: `web-async-routes.md`, `clerk-provider-lazy-chunk.md`).
- Removing the runtime `Platform.OS === "web"` branches inside the components.
- Any behavior change to native keyboard avoidance/dismissal.

## Merge plan
Three bundle-size specs each rewrite `scripts/bundle-baseline.json`. Whichever lands later must rebuild and regenerate the baseline after rebasing on dev.

## Open questions
- None.
