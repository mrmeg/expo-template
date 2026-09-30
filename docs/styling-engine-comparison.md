# Styling engine comparison (2026-09-29)

## Decision

Keep React Native `StyleSheet` in `@mrmeg/expo-ui` for now. None of the tested alternatives reduced shipped bytes on an equivalent, usable slice of this template. NativeWind 4 was the most complete package-consumer pilot: its app bundle grew by 6,841 bytes Brotli and its fresh Badge-only consumer grew by 55,431 bytes Brotli. The other pilots expose compatibility or migration work that prevents a like-for-like saving claim. This is a decision about this pinned Expo 58 beta template, not a general ranking of styling libraries.

The blocked migration spec, `Agent/styling-engine-migration.md`, should remain blocked unless a later candidate clears the acceptance criteria below. Do not start a kit-wide rewrite from the small Strict DOM probe's apparent near-zero app delta: that probe added a route and left all kit components on React Native Web.

## Baseline and method

- Revision: `5842b35` on `dev`. Each candidate used a clean detached worktree at this revision; experimental dependency and lockfile edits are absent from this comparison branch.
- Bun 1.3.14; Expo `58.0.0-preview.2`; React 19.2.3; React Native `0.88.0-rc.0`; React Native Web 0.21.2. Optional auth, billing, and Sentry environment values were blank.
- Versions tested: `react-native-unistyles@3.3.0` with `react-native-nitro-modules@0.35.2`; `nativewind@4.2.7` with `tailwindcss@3.4.17`; `@tamagui/core@2.7.7` plus matching Babel and Metro plugins; `react-strict-dom@0.0.55` with `postcss@8.5.28` and `autoprefixer@10.6.1`. [NativeWind 5 is still a prerelease explicitly marked unsuitable for production](https://www.nativewind.dev/v5/getting-started/installation), so it was deferred.
- Web: `bun run build`, `bun run bundle-size`, and `STYLING_BENCH_COOKIE='has-seen-onboarding=1; color-scheme=dark' node scripts/measure-styling-output.mjs dist/client http://localhost:<port> / /components/Button /showcase` against `PORT=<port> bun run start`. The cookie makes SSR render the app rather than onboarding. Results below count exported client JS and CSS, excluding source maps; route figures are script and stylesheet files linked from the first HTML response. Inlined SSR CSS and HTML are reported separately. These are transfer-byte proxies from precompressed `.br`/`.gz` files or Node compression; actual network transfer also depends on headers, cache, and protocol.
- Native: `EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 NODE_OPTIONS=--max-old-space-size=8192 bunx expo export --platform <ios|android> --output-dir <dir>`. Figures are Hermes `.hbc` bytes, not IPA/APK or native binary size. No device render or native binary build was completed. This matters particularly for Unistyles' Nitro native module.
- Package: `bun run pkg ui build`, `bun run pkg ui pack`, and `bun pm pack --filename <file> --quiet` in `packages/ui`. A fresh consumer is built with `node scripts/measure-ui-badge-consumer.mjs <tarball> <stylesheet|nativewind>`; it imports only `@mrmeg/expo-ui/components/Badge`. This measures all consumer JS/CSS, not app startup assets.
- The pilots were built once each. No run-to-run variance has been established; deltas of a few hundred bytes should not be treated as a reliable saving. The source-map attribution build uses `bun run build-web` separately and includes source-map comments, so its own total should not be compared to the production totals below.

## Shipped bytes

All sizes below are **bytes**. `Web total` is all exported client JS and CSS in Brotli; `initial` is linked JS/CSS Brotli on that SSR route. The initial figures exclude HTML and inline styles, shown in the next table.

| Pilot | Web JS raw | Web CSS raw | Web total br | Δ total br | `/` initial br | Button initial br | Gallery initial br | iOS Hermes | Android Hermes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| StyleSheet | 5,940,038 | 0 | 1,178,004 | — | 387,084 | 383,497 | 383,490 | 6,372,415 | 6,416,767 |
| Unistyles 3, partial | 6,003,470 | 0 | 1,188,804 | +10,800 (+0.92%) | 399,104 | 395,373 | 395,367 | 6,409,912 | 6,454,275 |
| NativeWind 4, partial | 5,937,057 | 9,926 | 1,184,845 | +6,841 (+0.58%) | 393,241 | 389,643 | 389,636 | 6,404,737 | 6,449,170 |
| Tamagui core, Badge only, compiler off | 6,090,698 | 0 | 1,212,453 | +34,449 (+2.92%) | 422,010 | 418,274 | 418,275 | 6,640,821 | 6,685,298 |
| Strict DOM, additive route only | 5,947,050 | 1,021 | 1,179,156 | +1,152 (+0.10%) | 387,167 | 383,443 | 383,438 | 6,440,799 | 6,484,919 |

The Unistyles row is from the SSR-hook revision. Its native exports were measured before adding the web server hook; those native numbers are **not** a final integrated build. The Strict DOM row adds `/strict-dom-probe` rather than replacing the kit, so its small web delta and larger native delta are only an integration probe. The Tamagui row omits its compiler because the compiler build failed. These three rows cannot be used to rank final migrated products.

The web JS-only gzip totals were 1,466,652 (baseline), 1,480,982 (Unistyles), 1,472,704 (NativeWind), 1,508,325 (Tamagui), and 1,467,759 (Strict DOM). NativeWind's CSS adds 2,419 gzip / 2,065 Brotli; Strict DOM's CSS adds 566 gzip / 485 Brotli. The exported non-JS/CSS assets were 520,310 raw / 485,549 gzip / 483,992 Brotli bytes in each pilot. `bun run bundle-size` remained under the existing 10% guard for baseline and tested builds; that guard excludes the optional HEIC chunk and does not include CSS or route download cost.

| Pilot | `/` HTML | `/` inline CSS | Button HTML | Button inline CSS | SSR and browser result |
|---|---:|---:|---:|---:|---|
| StyleSheet | 96,950 | 37,230 | 108,395 | 37,230 | RNW rules present on first response |
| Unistyles 3 | 94,134 | 41,135 | 101,380 | 41,135 | `getServerUnistyles` put `.unistyles_` rules in initial HTML; after hydration, the inspected browser had 219 `unistyles_` elements but zero matching stylesheet rules, even with `hydrateServerUnistyles` in an effect |
| NativeWind 4 | 95,838 | 35,930 | 107,283 | 35,930 | CSS linked on first response; initial `flex-row` lost to RNW reset until explicit utility priority was added |
| Tamagui core | 97,701 | 37,528 | 109,146 | 37,528 | Badge visually styled, but `accessibilityRole="text"` emitted as `accessibilityrole`, not a role |
| Strict DOM | 96,458 | 36,544 | 107,903 | 36,544 | CSS directive emitted a 1,021-byte sheet; probe's button had expected computed color and padding after a fresh server restart |

The native exports for partial pilots grew over baseline by 37,497/37,508 bytes (Unistyles), 32,322/32,403 (NativeWind), 268,406/268,531 (Tamagui), and 68,384/68,152 (Strict DOM) on iOS/Android respectively. These are JS/Hermes changes only. Native dependency install size was also measured with `du -sk node_modules`: baseline 1,868,888 KiB; Unistyles 1,878,256; NativeWind 1,892,720; Tamagui 1,923,664; Strict DOM 1,887,080. Install footprint is not bundle size. A source-map build took 32.6 seconds to bundle baseline web and 33.2 seconds for NativeWind web on the same machine; those single runs are diagnostic, not a build speed claim.

## Package consumer and tree shaking

| Packed UI | Tarball | Badge-only consumer JS/CSS raw | gzip | Brotli |
|---|---:|---:|---:|---:|
| StyleSheet | 261,611 | 318,415 | 96,187 | 80,779 |
| NativeWind 4 | 261,651 | 591,057 | 165,520 | 136,210 |

The 40-byte tarball change hides the consumer cost. NativeWind's fresh consumer installed its Babel/Metro/Tailwind setup and scanned the packed UI `dist` for utilities; the web export succeeded and emitted 9,520 bytes of CSS. It shipped 55,431 more Brotli bytes (+68.6%) than the same Badge-only baseline consumer. It also needed `nativewind-env.d.ts` inside the UI package for that package's own TypeScript build. A real release would need a package peer/dependency and setup contract, which triggers a package version bump here. The other pilots did not produce a type-correct, behavior-equivalent packed Badge consumer, so there is no consumer number for them.

The source-map explorer output for the full app attributed 14,777 mapped raw bytes to `react-native-css-interop` in the NativeWind build and zero in baseline. React Native Web stayed at 284,719 mapped raw bytes in both; the kit was only partly converted and still needs RNW. This explains why a different styling syntax did not remove the old runtime. `packages/ui/src` mapped bytes moved from 255,579 to 253,362, much smaller than the new runtime. These are mapped source ranges, not independent Brotli sizes.

## Compatibility and migration scope

| Option | Findings | Scope before a safe migration |
|---|---|---|
| StyleSheet | Current theme, scoped color overrides, native `Pressable` interaction, public `StyleProp` API, and late RNW SSR flush already work in the template. | None. |
| Unistyles 3 | Its Babel plugin and Nitro dependency installed and web/native exports ran. A direct swap in `Badge`, `Button`, and `Item` failed `bun run pkg ui typecheck` because Unistyles style types are not assignable to this kit's React Native style props. The [documented server hook](https://unistyl.es/v3/guides/server-side-rendering/) put styles into Expo Router's initial HTML, but the browser lost those rules after hydration in this integration; calling its hydration hook in an effect did not fix that. The docs' packaged-library guidance requires consumer Babel processing. No native module binary or device check was run. | Design a type-safe public style contract, request-isolated SSR registry/hydration, native builds, and consumer setup. [Unistyles' library-author guide](https://unistyl.es/v3/other/for-library-authors/) is relevant. |
| NativeWind 4 | Root and UI package type checks passed; web and native exports ran. Static layout utilities in `Badge`, `Button`, and `Item` were tested while variant colors and interactions stayed on RN styles. In the browser, RNW's later `.css-g5y9jx` rule overrode `flex-row` until `!flex-row` was used. The production CSS link and `className` need equivalent handling in packed consumers. | Convert all dynamic tokens, light/dark and scoped themes, state styles, and consumer configuration. The partial pilot is not a full kit migration. |
| Tamagui core | A simple config/provider and one Badge primitive built without its compiler, but `bun run pkg ui typecheck` failed on the public `StyleProp<ViewStyle>` override. The Badge lost its role mapping. Enabling `@tamagui/babel-plugin` failed `bun run build` with `Importing native-only module ... ReactNativePrivateInitializeCore on web from ... ReactFabric-prod.js`; removing the Metro wrapper alone did not fix it. Its generated CSS was empty in the runtime-only trial. | Broader component/API and accessibility rewrite, compiler resolver work, theme/provider integration, packed consumer proof. [Expo guide](https://tamagui.dev/docs/guides/expo) and [compiler guide](https://tamagui.dev/docs/intro/compiler-install). |
| React Strict DOM | Documented Babel preset and PostCSS extraction build on this SDK. The directive must be imported from `app/_layout.tsx` for `expo-router/entry`; including `app/**/*` in PostCSS made the probe's styles appear. A mixed RNW + `html.*` route rendered on web and exported to Hermes, but is not the same `Badge`/`Button`/`Item` contract. The native [HTML support table](https://react.github.io/react-strict-dom/api/html/) excludes some elements and notes limited layout; [CSS support](https://react.github.io/react-strict-dom/api/css/) includes polyfills and unsupported values. | Rewrite markup, events, style override types, tokens/themes, and package CSS extraction path; compare native behavior on devices. [Expo setup](https://react.github.io/react-strict-dom/learn/setup/) does not by itself prove this packed kit's consumer path. |

Theme parity was only established for the unchanged parts of the app and the NativeWind pilot's retained RN style paths. Full light/dark/scoped override parity was **not** established for any alternative. Browser checks used production servers and confirmed NativeWind's corrected row layout, Tamagui's Badge rendering/accessibility issue, and Strict DOM's computed button styling. Hydration console warnings were not captured as a controlled automated gate; native rendering/interactions on simulator/device were not checked. None of the partial candidates meets the migration spec's parity gate yet.

## Reproduce

From `5842b35`, use an isolated worktree for each option. Run `bun install --frozen-lockfile`, `bun run build`, `bun run bundle-size`, `PORT=8877 bun run start`, then the measurement command above. Build native exports with the exact environment flags above. For the measured NativeWind candidate:

```sh
STYLING_REPORT_CHECKOUT="$(pwd)" # from the comparison branch checkout
git worktree add --detach /tmp/styling-nativewind 5842b35
cd /tmp/styling-nativewind
bun install --frozen-lockfile
bun add --exact nativewind@4.2.7 tailwindcss@3.4.17
git apply "$STYLING_REPORT_CHECKOUT/scripts/nativewind-4-pilot.patch"
bun run pkg ui typecheck
bun run build
```

The analogous `scripts/unistyles-3-pilot.patch`, `scripts/tamagui-core-pilot.patch`, and `scripts/react-strict-dom-pilot.patch` capture the tested code/config changes. Their package installs are listed in the method above; the Tamagui patch is the runtime-only build after disabling the failing compiler. The Unistyles SSR patch includes `getServerUnistyles` and `resetServerUnistyles`; native export figures predate that last server-only import, so rerun both platforms before interpreting native compatibility. The Strict DOM patch adds a route, so its totals cannot represent a kit replacement. Use `bun run build-web` and `source-map-explorer` as in `docs/bundle-analysis.md` to repeat module attribution. The single-build raw results and temporary logs were generated locally; the scripts and patches here are the durable reproduction artifacts.

## Gate for revisiting

A later proposal should first show a type-correct packed Badge consumer and styled, warning-free first paint for `/`, `/components/Button`, and `/showcase`; then verify light/dark/scoped themes and native interactions; then compare total, initial-route, and consumer Brotli bytes under the same pinned toolchain. A small local reduction in `StyleSheet.create` source or package tarball size alone does not satisfy the bundle-size goal.

## Comparison branch validation

`git diff --check`, `bun run docs:llms:check`, `bun run pkg ui consumer-smoke`, and `bun run verify` passed on the comparison branch. The generated LLM bundle does not list `docs/bundle-analysis.md` as an input, so no generated docs changed. The pilot failures and missing device checks above are experimental results, not failures of the unchanged template.
