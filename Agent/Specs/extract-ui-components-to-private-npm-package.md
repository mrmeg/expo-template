# Spec: Extract UI Components to Private NPM Package

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

Create a private-distribution, reusable React Native / Expo UI package from the current `client/components/ui` design system so this template and other projects can import the same primitives through a package name instead of copying files. The work should first prove the package locally inside this repo, prove the packed artifact can be installed like a consumer would install it, then document the private npm publish and consumer setup.

## Why

The template already has a substantial cross-platform design system, but it is locked to this repo through `@/client/...` imports and app-local shared helpers. Packaging it behind a stable private npm interface makes the components reusable across the user's other Expo projects while keeping this repo as the source of truth.

## Current State

- `client/components/ui/` contains 35 UI primitives plus colocated tests, including layout, form, feedback, overlay, navigation, typography, and shell utility components.
- Most UI components are not package-portable today. They import repo-local modules such as:
  - `@/client/hooks/useTheme`
  - `@/client/constants/colors`, `fonts`, and `spacing`
  - `@/client/lib/haptics`, `animations`, and `sentry`
  - `@/client/state/globalUIStore`
  - sibling UI modules through absolute `@/client/components/ui/...` paths
- There is no `client/components/ui/index.ts` barrel, so app code imports each component by deep repo path.
- `Agent/Docs/DESIGN.md` describes the UI library as app-local under `client/components/ui/`, including the `@rn-primitives` style-array crash rule and the themed token system.
- `Agent/Docs/ARCHITECTURE.md` treats `client/components/ui/*`, `client/constants/*`, `client/hooks/*`, `client/lib/*`, and `client/state/*` as part of the shared client layer.
- `client/showcase/registry.ts` records component import paths as `@/client/components/ui/<Component>`, and `client/showcase/__tests__/registry.test.ts` pins that convention.
- `scripts/generate.ts` scaffolds new UI components into `client/components/ui/` with `@/client/...` imports, so the generator would keep creating non-portable components unless it is updated.
- Root package management uses Bun (`bun.lock` committed), TypeScript strict mode, Jest with `jest-expo`, and Metro wrapped by Reanimated.

## Changes

1. Create the package boundary.

   Add a workspace package at `packages/ui/` and make the root project aware of it.

   Files likely affected:
   - `package.json`
   - `bun.lock`
   - `tsconfig.json`
   - `metro.config.js`
   - `packages/ui/package.json`
   - `packages/ui/tsconfig.json`
   - `packages/ui/src/index.ts`
   - `packages/ui/src/components/*`
   - `packages/ui/src/constants/*`
   - `packages/ui/src/hooks/*`
   - `packages/ui/src/lib/*`
   - `packages/ui/src/state/*`

   Package defaults:

   ```json
   {
     "name": "@mrmeg/expo-ui",
     "version": "0.1.0",
     "private": false,
     "publishConfig": {
       "access": "restricted"
     }
   }
   ```

   `private: false` is intentional because npm refuses to publish packages marked `private: true`. The package is private by npm access control (`publishConfig.access = "restricted"` plus org/user permissions), not by the package.json `private` flag. Keep the root app package private. Do not commit an npm auth token or user-specific registry credential.

2. Move the portable UI surface into the package.

   Move the reusable design-system code, not the whole app, into `packages/ui/src/`.

   Include:
   - UI primitives currently in `client/components/ui/`
   - UI design tokens from `client/constants/colors.ts`, `fonts.ts`, and `spacing.ts`
   - UI hooks required by exported components and app startup, including `useTheme`, `useDimensions`, `useScalePress`, `useStaggeredEntrance`, `useReduceMotion`, and `useResources`
   - Small UI helpers required by exported components, including `haptics`, `animations`, and the Sentry bridge used by `ErrorBoundary`
   - Stores required by exported components, including theme state and global notification state
   - Font/icon assets or a documented package-owned loading hook so consumers do not have to copy `assets/fonts/Lato/*` by hand

   Do not move app-specific features (`client/features/*`), route code (`app/*`), server code, billing/media/auth business logic, or screen templates as part of this spec.

3. Remove repo-local aliases from exported package code.

   Package source must not import from `@/client/...`. Use package-relative imports inside `packages/ui/src` so the package can compile outside this repo.

   Example target shape:

   ```tsx
   import { useTheme } from "../hooks/useTheme";
   import { spacing } from "../constants/spacing";
   import { StyledText } from "./StyledText";
   ```

   Keep the existing `StyleSheet.flatten()` pattern for `@rn-primitives` style props. This is required for React Native Web stability.

4. Define public exports, build output, and peer dependencies.

   Expose a stable root barrel and subpath exports so consuming apps can choose either broad or focused imports.

   Required export surfaces:
   - `@mrmeg/expo-ui`
   - `@mrmeg/expo-ui/components`
   - `@mrmeg/expo-ui/components/Button` style subpaths for each component
   - `@mrmeg/expo-ui/constants`
   - `@mrmeg/expo-ui/hooks`
   - `@mrmeg/expo-ui/state`

   The published artifact must include JavaScript and declaration files in `dist/`; do not rely on every consuming app transpiling TypeScript from `node_modules`. Local workspace development may point Metro and TypeScript at source, but `bun pack --dry-run` must prove the package publishes only the intended source/build files, package metadata, declarations, and assets.

   Treat these as peer dependencies where practical:
   - `react`
   - `react-native`
   - `react-native-web`
   - `expo`
   - `@expo/vector-icons`
   - `expo-font`
   - `expo-haptics`
   - `@react-native-async-storage/async-storage`
   - `react-native-safe-area-context`
   - `react-native-reanimated`
   - `react-native-gesture-handler`
   - `@rn-primitives/*`
   - `zustand`
   - `@sentry/react-native` if `ErrorBoundary` / Sentry helpers remain exported

   Keep build-only tools in the package dev dependencies.

5. Make this app consume the package.

   Replace app-local UI imports with package imports to prove the package contract in the template itself.

   Examples:

   ```tsx
   import { Button } from "@mrmeg/expo-ui/components/Button";
   import { spacing } from "@mrmeg/expo-ui/constants";
   import { useTheme } from "@mrmeg/expo-ui/hooks";
   import { useResources } from "@mrmeg/expo-ui/hooks";
   ```

   Update consumers in:
   - `app/**`
   - `client/screens/**`
   - `client/features/**`
   - `client/lib/form/**`
   - `client/showcase/**`
   - `scripts/generate.ts`
   - `test/mockTheme.ts`
   - UI component tests that move with the package

6. Update tests and package validation.

   Move or duplicate the UI component tests under `packages/ui/src/**/__tests__/` and make them runnable from the root test command. Add package-specific validation scripts.

   Required scripts:
   - root `bun run typecheck`
   - root `bun run test:ci`
   - root `bun run build`
   - package `bun run typecheck`
   - package `bun run test`
   - package `bun run build`
   - package `bun pack --dry-run` or equivalent publish-dry-run script
   - a local consumer smoke check that installs the packed `.tgz` into a temporary Expo app or fixture and verifies TypeScript can import representative component, hook, and token subpaths

   Update `jest.config.js` if package tests or package source paths are not covered by the existing configuration.

7. Update Metro and TypeScript resolution.

   Configure local workspace resolution so Expo, Metro, Jest, and TypeScript all resolve `@mrmeg/expo-ui` consistently during development.

   Requirements:
   - no duplicate React, React Native, React Navigation, Reanimated, Gesture Handler, Safe Area Context, or `@rn-primitives` runtime copies
   - package source can be transformed by Metro
   - type declarations resolve for package imports
   - existing Reanimated Metro wrapping remains intact
   - package exports resolve the same way under Bun, TypeScript, Jest, Metro, and the packed npm artifact

8. Update docs and generator behavior.

   Update:
   - `README.md`
   - `Agent/Docs/DESIGN.md`
   - `Agent/Docs/ARCHITECTURE.md`
   - `client/showcase/registry.ts`
   - `client/showcase/__tests__/registry.test.ts`
   - `scripts/generate.ts`
   - `scripts/__tests__/generate.test.ts`

   Docs must explain:
   - package name and import examples
   - which UI pieces are exported
   - how to publish a private version
   - how consuming Expo apps should install and configure peer dependencies
   - that npm auth tokens belong in developer/CI environment config, not in the repo

## Acceptance Criteria

1. `packages/ui/package.json` exists with a scoped package name, private npm publish configuration, explicit peer dependencies, and scripts for typecheck, test, and publish dry-run.
2. The package has a build step that emits JavaScript and type declarations under `packages/ui/dist`, and the package export map points at those files for the publish artifact.
3. Exported package source has no imports matching `@/client/...`.
4. The template app imports UI components, UI hooks, UI constants, and the UI resource-loading hook from `@mrmeg/expo-ui` instead of `@/client/components/ui`, `@/client/hooks/useTheme`, `@/client/hooks/useResources`, or UI token files where those values are package-owned.
5. `client/showcase/registry.ts` and its tests validate the package import paths instead of app-local UI paths.
6. `scripts/generate.ts` creates new UI components in the package or otherwise emits package-portable imports, and its tests cover the updated paths.
7. Local workspace development resolves one copy of React / React Native / Reanimated / Gesture Handler / Safe Area Context / `@rn-primitives` at runtime.
8. `bun run typecheck` passes from the repo root.
9. `bun run test:ci` passes from the repo root.
10. `bun run build` passes from the repo root.
11. The UI package's own typecheck, test, build, and publish dry-run scripts pass.
12. A packed-package consumer smoke check proves representative imports from the `.tgz` artifact resolve in a clean Expo-style fixture.
13. README and Agent docs document private package publishing and consuming-app setup without committing secrets.

## Constraints

- Do not publish to npm as part of the implementation unless the human explicitly asks for the publish step.
- Do not commit `.npmrc` auth tokens, npm access tokens, registry passwords, or CI secrets.
- Keep the existing visual design, token names, component props, and runtime behavior stable unless a small compatibility shim is required for packaging.
- Preserve React Native Web crash prevention patterns, especially `StyleSheet.flatten()` for `@rn-primitives` style props.
- Do not introduce a second design-token source of truth. Tokens should live in the package and be imported by this app.
- Keep root package manager behavior Bun-first and preserve `bun.lock`.
- Avoid forcing unrelated feature modules into the package just because they consume UI.
- Keep package runtime code free of app route imports, server imports, and `@/` aliases.
- Keep npm package metadata honest: the root app remains `private: true`; the UI package remains publishable with restricted access.

## Out of Scope

- Publishing the first production version to npm.
- Creating a public documentation site or Storybook.
- Moving screen templates from `client/screens/` into the UI package.
- Extracting auth, billing, media, navigation, onboarding, or API utilities.
- Supporting non-Expo React Native consumers that cannot meet the package peer dependency contract.
- Re-theming components or redesigning the UI system.
- Creating a separate repository for the package.

## Files Likely Affected

Client / package:
- `client/components/ui/**`
- `client/constants/colors.ts`
- `client/constants/fonts.ts`
- `client/constants/spacing.ts`
- `client/hooks/useTheme.ts`
- `client/hooks/useDimensions.ts`
- `client/hooks/useReduceMotion.tsx`
- `client/hooks/useScalePress.ts`
- `client/hooks/useStaggeredEntrance.ts`
- `client/lib/animations.ts`
- `client/lib/haptics.ts`
- `client/lib/sentry.ts`
- `client/state/themeStore.ts`
- `client/state/globalUIStore.ts`
- `packages/ui/**`

Client consumers:
- `app/**`
- `client/screens/**`
- `client/features/**`
- `client/lib/form/**`
- `client/showcase/**`
- `client/components/ErrorScreen.tsx`

Tooling and docs:
- `package.json`
- `bun.lock`
- `tsconfig.json`
- `metro.config.js`
- `jest.config.js`
- `scripts/generate.ts`
- `scripts/__tests__/generate.test.ts`
- `README.md`
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/ARCHITECTURE.md`

## Edge Cases

- Consuming apps without all peer dependencies should fail during install or typecheck with a clear missing-peer dependency, not at runtime with an opaque Metro error.
- Consuming apps with a different React Native / Expo SDK version may install but should be documented as unsupported until manually validated.
- Consuming apps must not have to copy this repo's font files manually; either the package ships the fonts/resource loader or the docs describe an explicit fallback path that keeps UI readable.
- Web builds must not regress into the known `CSSStyleDeclaration` / raw style-array failure mode.
- The package should not create duplicate Zustand stores when imported through different subpaths.
- Theme state must remain shared between `useTheme`, themed components, `StatusBar`, and `Notification`.
- `ErrorBoundary` must still no-op gracefully when Sentry is not configured.
- Package consumers should be able to tree-shake or deep-import a single component without pulling app routes, server code, or screen templates.
- Root app tests must still mock package-owned theme and haptic modules cleanly.
- Packed package contents must not include app secrets, `.env*`, `dist/` from the root web build, Agent files, or unrelated app/server source.

## Risks

- **Metro duplicate module risk:** workspace packages can accidentally load duplicate React Native runtime modules. Mitigate with explicit peer dependencies, Metro resolver configuration, and a validation pass that imports the package through the app.
- **Scope creep risk:** moving every shared client helper would turn this into a full template split. Mitigate by limiting the package to UI primitives, UI tokens, UI hooks, and direct UI runtime helpers.
- **Breaking import churn:** replacing app-local paths across routes, features, screen templates, tests, and generator templates is broad. Mitigate with mechanical import updates plus typecheck and test coverage.
- **Private npm configuration risk:** registry credentials are machine/CI-specific. Mitigate by documenting `.npmrc`/CI secret setup without committing secrets.
- **Published artifact drift risk:** the workspace can pass while the packed npm artifact is broken. Mitigate with a package build, `bun pack --dry-run`, and the consumer smoke fixture before promotion is considered implemented.
