# Day Shift Report — 2026-05-02

## Completed

### Fix Button Event Handler Composition
**Git state:** Pending local changes.
**What changed:** Composed `Button` consumer focus and press handlers with the package-owned focus and scale-press internals, preserving disabled/loading suppression. Added focused Button tests for event forwarding and composed press behavior.

### Align Button Default Token Semantics
**Git state:** Pending local changes.
**What changed:** Made `secondary` neutral and kept `accent` teal in the shared color tokens. Updated Button presets so the default maps to primary tokens, secondary maps to neutral secondary tokens, and the fallback remains primary. Added token and Button style tests plus README guidance.

### Fix UI Package ESM Runtime Imports
**Git state:** Pending local changes.
**What changed:** Added a post-build ESM specifier rewrite for `packages/ui/dist` so emitted relative JS imports include `.js` or `/index.js`. Made font constants safe to import in Node by avoiding a top-level `react-native` import. Documented the build boundary in the UI package docs and README.

### Expand UI Consumer Smoke Runtime Coverage
**Git state:** Pending local changes.
**What changed:** Expanded `ui:consumer-smoke` to derive the tarball name dynamically, verify installed export-map files, typecheck all documented public entrypoints, and run a Node runtime import check for constants. Updated docs to describe the stronger smoke contract.

### Constrain UI Package Peer Dependencies
**Git state:** Pending local changes.
**What changed:** Replaced wildcard package peers with Expo SDK 55, React 19, React Native 0.83, RN Web 0.21, RN primitives, Reanimated, worklets, safe-area, gesture-handler, haptics, font, AsyncStorage, vector-icons, and Zustand ranges. Documented the SDK-aligned peer posture.

### Enrich UI Package npm Metadata
**Git state:** Pending local changes.
**What changed:** Added npm-facing metadata to `@mrmeg/expo-ui` including author, repository, directory, bugs URL, homepage, and targeted keywords. Kept the package `UNLICENSED` and added a README support-posture note clarifying that it is public for installability/reuse/discoverability but not a generally supported OSS UI library.

### Move Sentry Out of the UI Package
**Git state:** Pending local changes.
**What changed:** Removed the Sentry bridge and `@sentry/react-native` peer from `@mrmeg/expo-ui`. The package `ErrorBoundary` now accepts an app-owned `onError` callback, while this template keeps Sentry initialization and capture in `client/lib/sentry.ts`.

**Validation:** `bun run typecheck`; `bun run lint` (passes with the existing 148-warning baseline); `bun run check:features`; `bun run test:ci` (433 tests across 54 suites); `bun run build`; `bun run bundle-size` (5.73 MB, 37 JS files, no baseline set); `bun run ui:typecheck`; `bun run ui:test` (115 tests across 18 suites); `bun run ui:build`; `bun run ui:pack`; `bun run ui:consumer-smoke`.

**How to review:**
1. Inspect `packages/ui/src/components/Button.tsx` and `packages/ui/src/components/__tests__/Button.test.tsx` for event-handler composition.
2. Inspect `packages/ui/src/constants/colors.ts`, `packages/ui/src/hooks/__tests__/useTheme.test.tsx`, and `packages/ui/README.md` for token semantics.
3. Inspect `scripts/fix-ui-package-esm.mjs`, `packages/ui/package.json`, and `scripts/check-ui-package-consumer.mjs` for package build and consumer-smoke coverage.
4. Inspect `packages/ui/package.json` and `packages/ui/README.md` for peer dependency ranges and npm metadata.
5. Inspect `packages/ui/src/components/ErrorBoundary.tsx`, `client/lib/sentry.ts`, and `app/_layout.tsx` for app-owned Sentry reporting.

---

## In Progress

None.

## Blocked

None.

## Issues Discovered

- `ui:build`, `ui:pack`, and `ui:consumer-smoke` all touch package build artifacts; run package build checks sequentially when diagnosing failures.
- `bun run lint` still reports the repo's existing warning baseline, but exits 0.
- `bun run test:ci` still prints known console noise from existing billing/AuthGate tests, but all suites pass.
- The bundle-size script still has no committed baseline and reports that `bun run bundle-size --update` would establish one.

## Docs Updated

- `Agent/DAY_SHIFT_REPORT.md`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/EXPO_UI_PACKAGE.md`
- `Agent/Docs/PERFORMANCE.md`
- `packages/ui/README.md`

## Router State

- `Agent/AGENTS.md` task queue is empty.
- `Agent/Specs/` contains only `.gitkeep`.

## Next Ready Task

- None
