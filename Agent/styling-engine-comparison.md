---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Compare styling engines against the current StyleSheet baseline

## Goal
Determine whether replacing React Native `StyleSheet` reduces the code and assets delivered by this template and by a consumer of `@mrmeg/expo-ui`. Produce measured, reproducible results and a recommendation. Do not migrate the product in this branch.

## Context
- The app uses Expo Router with server-rendered web output and production web async routes (`app.config.ts`). `bun run build` enables Metro graph optimization and tree shaking; `docs/bundle-analysis.md` explains the existing budget and why total JS is different from a route's initial download.
- The UI package uses `StyleSheet.create`, module-scope `createThemedStyles` (`packages/ui/src/lib/themedStyles.ts`), and `useStyles` (`packages/ui/src/hooks/useTheme.ts`). The app flushes react-native-web rules after SSR in `client/features/app/SsrStyleFlush.tsx`; `app/+html.tsx` owns the client sheet anchor. A candidate must prove styled first paint and hydration on `bun run build && bun run start`.
- Tokens, theme state and scoped color overrides are in `packages/ui/src/constants/`, `packages/ui/src/hooks/useTheme.ts`, and `packages/ui/src/state/`. `packages/ui/package.json` is published to consumers; root app results alone do not establish its consumer cost.
- As checked 2026-09-29, [Unistyles 3](https://unistyl.es/v3/start/getting-started/) requires New Architecture and Nitro; its [SSR guide](https://unistyl.es/v3/guides/server-side-rendering/) documents Next.js, so Expo Router SSR remains unproven here. [NativeWind 4](https://www.nativewind.dev/docs/getting-started/installation) is stable but documents SDK 57 support; [NativeWind 5](https://www.nativewind.dev/v5/getting-started/installation) is a release candidate marked unsuitable for production. [Tamagui core](https://tamagui.dev/docs/intro/installation) is a styling system with an optional compiler and a larger design-system shift. [React Strict DOM](https://react.github.io/react-strict-dom/learn/setup/) has an Expo guide using a Babel preset and PostCSS extraction, but its [`html.*` components](https://react.github.io/react-strict-dom/learn/components/) make it a markup migration as well as a styling change. Its guide does not establish compatibility with this app's Expo Router SSR or packed UI consumers. Recheck versions, licenses, install and peer requirements when implementing; vendor size claims are not measurements.

## Work
1. Record the exact `dev` commit, Bun/Expo/RN versions, build flags, blank-env setup, and selected package versions in `docs/styling-engine-comparison.md`. Use clean, isolated worktrees from that same commit, one per candidate. Keep experimental dependencies and lockfiles out of the comparison PR.
2. Benchmark five configurations: current `StyleSheet`; Unistyles 3; stable NativeWind 4; Tamagui core with its documented Expo compiler if it runs in this stack; and React Strict DOM using its documented Expo Babel preset and PostCSS extraction. Include NativeWind 5 separately only if it has reached a production release and supports the pinned Expo SDK by the evaluation date; otherwise document it as deferred. Mark any candidate that cannot install/build with pinned SDK 58 as incompatible, with the failing command and error.
3. Use the same representative UI surface for each runnable configuration: a themed `Badge`, an interactive `Button`, an `ItemGroup`/`Item` row, and a screen using them. Keep variants, theme tokens, scoped overrides, accessibility, and visible behavior equivalent. For React Strict DOM, use its `html.*` primitives and `css.create`/theme API for the converted surface, then test alongside the still-RNW components; confirm the CSS directive loads through this app's `expo-router/entry`, and include the CSS and any retained RNW runtime in the measured output. Include one `@mrmeg/expo-ui` consumer that imports only `Badge` to reveal fixed runtime and peer costs; its fresh install must prove the required Babel/PostCSS processing of packed UI styles. Do not mistake a small fixture for the estimated cost of migrating the whole kit; state what remains in the baseline.
4. Measure **shipped output**, with identical production flags and routes: `bun run build` plus `bun run bundle-size`; web total client JS/CSS and assets (raw, gzip, brotli); JS/CSS loaded on initial `/` and `/components/Button` visits and the lazy gallery route; native iOS and Android production export JS/Hermes bundles where the platform build is available; and `bun run pkg ui pack` tarball size plus the consumer app's bundle. Use Expo Atlas or sourcemaps to attribute bytes to styling runtime, compiler output, and remaining RNW styles. Report deltas in bytes and percent against the matched baseline. Separately report dependency install size and build time as diagnostic metrics, not as bundle size. Record repeat runs or state measurement variance.
5. Validate SSR HTML styling before hydration, light/dark and scoped themes, hydration warnings, native rendering/interactions, tree shaking of unused UI exports, and package consumer build. Inspect Babel/Metro/PostCSS configuration conflicts (`metro.config.js`, package source export condition, Sentry/Reanimated wrappers). For React Strict DOM, check its native [HTML](https://react.github.io/react-strict-dom/api/html/) and [CSS](https://react.github.io/react-strict-dom/api/css/) support for the fixture, and record any unsupported UI behavior or rewrite cost. Native code and rebuild requirements count in the tradeoff table.
6. Put a compact decision matrix in the report: web initial route and total bytes, native bytes, consumer bytes, package tarball, SSR/hydration, theme behavior, setup/maintenance cost, compatibility, and migration scope. Recommend one option or retaining `StyleSheet`; distinguish measured results from inference. Link exact commands, source revision, and artifacts or logs. Update `docs/bundle-analysis.md` with a link to the report and run `bun run docs:llms` if that doc is in the generated source list.

## Validation
- `git diff --check`; `bun run docs:llms:check`; `bun run pkg ui consumer-smoke`; `bun run verify` on the comparison branch.
- A clean checkout can reproduce the baseline and at least one runnable candidate using the recorded commands and versions. Report failed candidates rather than weakening their checks.
- Serve the production web export with `bun run build && bun run start`; inspect the first response and browser first paint/hydration on the selected routes. Run an iOS and Android check for candidates with native dependencies where devices/build tooling are available; label missing device checks explicitly.

## Out of scope
- Replacing all production styles, changing the public UI API, publishing a package, or updating the bundle baseline to hide growth.
- Treating npm unpacked size or advertised library size as the app's bundle impact.

## Open questions
None. The comparison may conclude that the current `StyleSheet` approach is best.
