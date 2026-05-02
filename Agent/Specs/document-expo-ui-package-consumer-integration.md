# Spec: Document Expo UI Package Consumer Integration

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

Create LLM-friendly documentation for installing, configuring, and using the private `@mrmeg/expo-ui` package from downstream Expo apps. The documentation should give app LLMs a reliable reference for package imports, startup wiring, font loading, peer dependencies, publishing expectations, and update propagation across consumer apps.

## Why

The reusable UI package is intended to be published once and imported by multiple apps so shared UI updates can be pushed centrally. Consumer app LLMs need a concise, explicit reference that explains which setup belongs in each app, which behavior comes from the package, and how to avoid accidentally re-bundling assets such as font files.

## Current State

Reusable UI code now lives in `packages/ui` and publishes as `@mrmeg/expo-ui`. The package export surface is defined in `packages/ui/package.json` and includes root, `components`, `components/*`, `constants`, `hooks`, `state`, and `lib` subpaths.

`packages/ui/README.md` currently only covers the package purpose, the basic `bun add @mrmeg/expo-ui` command, and a peer dependency reminder. It does not yet document consumer app setup, publish/update workflow, LLM-oriented import guidance, or operational rules for app maintainers.

Font behavior is split between package runtime and app-owned web head setup. `packages/ui/src/hooks/useResources.ts` injects the Google Fonts Lato stylesheet on web and loads `Feather.font` from `@expo/vector-icons`; native platforms use system sans-serif fallbacks. `app/+html.tsx` preconnects to Google Fonts and includes the same Lato stylesheet for earlier web paint, but that file is template-app owned and will not ship in the npm package.

The design docs mention package imports and font behavior in `Agent/Docs/DESIGN.md`, but there is no dedicated consumer integration guide that downstream app LLMs can load as a stable reference.

## Changes

1. Add a dedicated consumer integration doc.

   Create `Agent/Docs/EXPO_UI_PACKAGE.md` as the canonical LLM reference for consuming `@mrmeg/expo-ui`. It should be written for both humans and app LLMs, with short sections and exact code examples rather than prose-only guidance.

   The doc must cover:

   - package purpose and ownership boundary
   - install command and private npm/auth expectations
   - peer dependency policy
   - supported import paths
   - app startup wiring with `useResources()`
   - web font setup in `app/+html.tsx`
   - native font fallback behavior
   - icon font behavior via `@expo/vector-icons`
   - theme provider usage with `colors`
   - notification and portal requirements where relevant
   - rules for adding package-owned components
   - publish and update propagation workflow
   - common mistakes for LLMs to avoid

2. Expand `packages/ui/README.md` for npm consumers.

   Update `packages/ui/README.md` so the published package itself includes enough setup guidance for consumers who do not have access to `Agent/Docs`. Keep it shorter than the Agent doc, but include:

   - installation
   - peer dependency note
   - common import examples
   - root startup example using `useResources`
   - optional Expo web `app/+html.tsx` font preload snippet
   - statement that no font files are shipped
   - publish dry-run command

3. Link the new doc from the router.

   Add `Agent/Docs/EXPO_UI_PACKAGE.md` to the System Docs table in `Agent/AGENTS.md` with an appropriate owner and purpose so future agents can discover it before changing package integration behavior.

4. Cross-link existing docs.

   Update `Agent/Docs/DESIGN.md` and `Agent/Docs/ARCHITECTURE.md` to point readers to `Agent/Docs/EXPO_UI_PACKAGE.md` for consumer setup details instead of duplicating the full instructions.

5. Add an LLM quick-reference section.

   In `Agent/Docs/EXPO_UI_PACKAGE.md`, include a compact "LLM Rules" section with direct instructions such as:

   ```md
   - Import reusable UI from `@mrmeg/expo-ui`, not app-local copied files.
   - Do not add `.ttf` files to the package for Lato.
   - On web, use `useResources()` plus app-owned `+html.tsx` preload links.
   - On native, rely on system sans-serif unless a future spec explicitly adds remote native font support.
   - Keep package code free of `@/client/*` imports.
   ```

## Acceptance Criteria

1. `Agent/Docs/EXPO_UI_PACKAGE.md` exists and explains consumer setup clearly enough for a downstream app LLM to install and wire the package without reading implementation files first.
2. The new doc includes exact import examples for `@mrmeg/expo-ui/components`, `@mrmeg/expo-ui/components/*`, `@mrmeg/expo-ui/constants`, `@mrmeg/expo-ui/hooks`, `@mrmeg/expo-ui/state`, and `@mrmeg/expo-ui/lib`.
3. The new doc explicitly states that `@mrmeg/expo-ui` does not ship Lato font files and documents the web/native font behavior.
4. `packages/ui/README.md` includes npm-consumer setup guidance that will be present in the published package.
5. `Agent/AGENTS.md` includes the new doc in the System Docs table.
6. Existing architecture/design docs link to the new doc for package consumer details.
7. `git diff --check -- Agent packages/ui/README.md` passes.

## Constraints

- Do not add font files or other binary assets to `packages/ui`.
- Do not change package runtime behavior as part of this documentation spec.
- Do not document unpublished APIs or app-local imports as stable package APIs.
- Keep examples compatible with Expo Router apps.
- Keep npm auth/token guidance generic; do not commit secrets or organization-specific tokens.

## Out of Scope

- Publishing the package to npm.
- Creating a consumer app fixture beyond the existing smoke test.
- Changing the `@mrmeg/expo-ui` export map.
- Adding native remote font loading.
- Adding automated documentation generation.

## Files Likely Affected

Client / Docs:

- `Agent/Docs/EXPO_UI_PACKAGE.md`
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/AGENTS.md`
- `packages/ui/README.md`

## Edge Cases

- A consumer app does not render on web: the doc should still describe native fallback behavior without requiring `app/+html.tsx`.
- A consumer app skips the web preload links: the doc should explain that `useResources()` can still inject the stylesheet after hydration, with a possible first-paint fallback.
- A consumer app uses direct component subpath imports: the doc should show that `@mrmeg/expo-ui/components/Button` is supported by the package export map.
- A consumer app LLM wants to copy package files locally: the doc should direct it to depend on the package instead.
- A future maintainer wants a new package asset: the doc should make clear that adding binary assets requires a separate spec because package size is a constraint.

## Risks

- Documentation can drift from the package export map. Mitigate by referencing `packages/ui/package.json` as the source of truth and keeping examples limited to exported subpaths.
- LLMs may overgeneralize font behavior across native and web. Mitigate with explicit platform-specific rules and "do not add `.ttf` files" guidance.
