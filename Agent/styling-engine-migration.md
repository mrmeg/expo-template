---
status: blocked
mode: AFK
base-branch: dev
blocked-by: Complete Agent/styling-engine-comparison.md, select and record a production-compatible winner with a measured benefit, then replace the placeholders in this spec with its exact name, version, and integration steps.
pr: -
---

# Migrate UI package and app styles if a measured engine wins

## Goal
Replace the template's React Native `StyleSheet` styling path with the engine selected by `Agent/styling-engine-comparison.md`, while preserving UI behavior, theme contracts, server-rendered first paint, and a publishable `@mrmeg/expo-ui`. A candidate must deliver a measurable net size benefit to justify this migration. If the comparison recommends retaining `StyleSheet`, close this spec without an implementation branch.

## Context
- Read the completed `docs/styling-engine-comparison.md` first. Copy its winner, exact version, native requirements, transform configuration, measured baseline and expected bytes here before marking this spec ready. Do not infer a winner from vendor marketing.
- `packages/ui/src/lib/themedStyles.ts` eagerly creates light/dark styles for server rendering. `packages/ui/src/hooks/useTheme.ts` exposes theme utilities and `useStyles`; `client/features/app/SsrStyleFlush.tsx` flushes RNW rules; `app/+html.tsx` supplies the CSS sheet anchor and first-render color-scheme script. `docs/server-guide.md` explains why cold SSR requests and lazy routes are sensitive to style registration order.
- Design tokens and theme state belong to `packages/ui/src/constants/` and `packages/ui/src/state/`. The lint package enforces token and component use in app code. UI exports, peer dependencies, `sideEffects`, and consumer build behavior are defined by `packages/ui/package.json` and `packages/ui/README.md`.
- As of 2026-09-29 the app is Expo SDK 58 / RN 0.88 RC with Bun workspaces, a custom Metro resolver in `metro.config.js`, and server-rendered web. Recheck the branch versions when this spec is unblocked. A runtime or Babel/Metro requirement imposed on published UI consumers is a public integration change; document and version it rather than hiding it behind an internal import.

## Work
1. Recreate the comparison's verified fixture from its recorded commands on current `dev` and confirm its result still holds. Record the candidate's exact version and setup, the baseline commit, target compatibility, and measured expected improvement in this spec and the implementation PR. If the candidate is prerelease, incompatible with the current SDK, fails server rendering, or has no persuasive net benefit, leave this spec blocked and report the result.
2. Configure the chosen engine for the app and published UI package (`package.json`, `bun.lock`, `metro.config.js`, Babel/config files only as required). Keep Bun's lockfile and the package's source and `dist` export paths working. Use a package version bump when changing `dependencies`, `peerDependencies`, `peerDependenciesMeta`, `exports`, or `files`; update consumer setup docs and changelog for any new install or transform requirement. Keep public component props and token names unless a breaking change is separately approved and documented.
3. Migrate package styles in `packages/ui/src/components/` and style helpers in `packages/ui/src/lib/` and `hooks/` in coherent groups. Preserve `Button`, `Badge`, `ItemGroup`/`Item`, overlays, portals, modals, animations, native hit targets, and scoped themes. Preserve a compatibility export for `createThemedStyles`/`useStyles` only if real external consumers need it; identify that decision from package usage and document any deprecation. Remove the old implementation only after all internal imports are gone.
4. Migrate app-owned styles in `app/` and `client/`, including templates, blocks, and showcase. Keep the five gallery route shells lazy and prevent a shared styling import from hoisting gallery-only code into the eager web bundle. Keep design-system lint rules and generated manifest accurate; do not weaken rules to silence the migration.
5. Replace or adapt `SsrStyleFlush` and the `+html.tsx` sheet anchor only after proving the new engine's production server output. Verify cold server process, first request, repeated requests, two concurrent requests with different schemes/viewport hints, and a lazy route on a cold browser cache. Server HTML must contain usable styles before hydration and hydrate without mismatches or a light/dark flash. Remove RNW-specific flush code only if no remaining component needs it.
6. Update `packages/ui/README.md`, `packages/ui/LLM_USAGE.md`, `packages/ui/CHANGELOG.md`, `docs/server-guide.md`, `docs/template-modernization-guide.md`, and `docs/bundle-analysis.md` with the actual styling contract and measured post-migration result. Run `bun run docs:llms` for generated docs. Regenerate any other affected artifacts with `bun run gen`; never edit generated files by hand.

## Validation
- `bun run pkg ui typecheck`, `bun run pkg ui test`, `bun run pkg ui build`, `bun run pkg ui pack`, `bun run pkg ui consumer-smoke`, `bun run typecheck`, `bun run lint`, `bun lint:ui --changed`, `bun run packages:peer-check`, `bun run packages:drift-check`, `bun run gen --check`, and `bun run verify`.
- `bun run build && bun run bundle-size`, then `bun run start`. Use a browser against that production server, inspect source HTML before hydration and first paint in light/dark on `/`, `/settings`, `/components/Button`, and a gallery route, then check hydration and navigation. Include a cold server restart and concurrent requests; test native iOS and Android component rendering and interactions on a simulator/emulator or record the missing device check.
- Repeat the comparison's web route, total client, native JS/Hermes, package tarball, and minimal-consumer measurements on the same baseline method. Report raw/gzip/brotli bytes and deltas, with screenshots or logs for visual and SSR checks. Do not update `scripts/bundle-baseline.json` until the change and its new target are explained in the PR.
- If a published consumer now needs a new native module, Babel preset/plugin, CSS source scan, or Metro wrapper, prove a fresh external Expo consumer install/build from the packed UI package and include exact setup and migration instructions. Count that as a breaking integration change in release planning.

## Out of scope
- Changing the design system's visual language, public icon API, auth/billing/media integrations, or unrelated package dependencies.
- Publishing the package or deploying the app in this branch.

## Open questions
- Winner and exact version: blocked on the comparison report and owner selection.
- Whether external UI consumers can keep their current setup: blocked on the packed-consumer fixture from the comparison.
