---
status: ready
mode: HITL
base-branch: dev
blocked-by: -
pr: -
---

# Adopt Expo SDK 58 beta

## Goal

Move the template from Expo SDK 57 / React Native 0.86 onto the SDK 58 beta (`expo@next`, React Native 0.88 RC), retire the two SDK 57 workarounds that 58 makes redundant (the vendored iOS scene-lifecycle config plugin and the `@expo/router-server` bootstrap-order patch), adopt the router surfaces 58 stabilizes that the template already exercises (native tabs import, `unstable_settings.anchor`, middleware without an opt-in flag), and bring package peer ranges, CI, and version prose along.

## Context

Verified 2026-09-15 against npm `next` tags and unpacked tarballs.

- Versions: expo `58.0.0-preview.2`, expo-router `58.0.3`, expo-server `58.0.0`, @expo/router-server `58.0.2`, jest-expo `58.0.2`, @expo/ui `58.0.2`, react-native `0.88.0-rc.0` (peer `react ^19.2.3`). Changelog: https://expo.dev/changelog/sdk-58-beta. Router migration guide: https://docs.expo.dev/router/migrate/sdk-57-to-58/.
- `ios/` and `android/` are gitignored (CNG); `npx expo prebuild --clean` regenerates them. Local toolchain: Node 26.8.2, Bun 1.3.14, Xcode 27.0 beta. SDK 58 requires Node ≥22.13, ≥24.3, or 26. `.github/workflows/ci.yml` never sets up Node and relies on the runner default.
- `plugins/withIosSceneLifecycle.js` self-disables by probing `node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift`. expo 58 ships that file at `ios/Expo/ExpoAppSceneDelegate.swift`, so the probe misses and the plugin would vendor a second `@objc(SceneDelegate)` class next to the one the 58 template generates. It must be deleted, not left to self-disable. Wired in `app.config.ts:5` and `app.config.ts:194-196`.
- `patches/@expo%2Frouter-server@57.0.9.patch` plus `package.json` `patchedDependencies` reorder React's async bootstrap scripts. `@expo/router-server@58.0.2` `build/server/renderStreamingContent.js` no longer passes `bootstrapScripts` to React; it emits `<link rel="preload">` head nodes and in-order body scripts through `createInjectedScriptAsNodes`. The patch is superseded. `__tests__/ssrHydration.guardrail.test.ts` (describe "@expo/router-server bootstrap-order patch") asserts the patch exists and will fail after the bump. `app/+html.tsx:164` and `docs/server-guide.md:244` reference the patch.
- expo-router 58 config plugin (`plugin/options.json`, `plugin/build/withRouter.js`): `unstable_useServerMiddleware` is deprecated, warns once, and has no effect. `unstable_useServerRendering` and `unstable_useServerDataLoaders` are still read by @expo/cli 58.0.2 (`MetroBundlerDevServer.js`, `exportStaticAsync.js`, `createServerRouteMiddleware.js`) and must stay. `asyncRoutes` is still opt-in: `getAsyncRoutesFromExpoConfig` returns false when unset, so `asyncRoutes: { web: "production" }` stays despite the changelog wording.
- expo-router 58 runtime deprecations the template triggers: `expo-router/unstable-native-tabs` warns and points to `expo-router/native-tabs` (`app/(main)/(tabs)/_layout.tsx:2`); `unstable_settings.initialRouteName` warns and points to `anchor` (`client/config/routerSettings.ts`, re-exported by `app/_layout.tsx`, `app/(main)/_layout.tsx`, `app/(main)/_layout.web.tsx`). The migration guide also replaces the `<Stack initialRouteName>` prop with `anchor` (`client/features/navigation/MainLayout.tsx:17`, `client/features/navigation/WebMainLayout.tsx:44`). No `expo-router/react-navigation` imports, `freezeOnBlur`, `navigationKey`, `initialParams`, or `Screen redirect` usage exists.
- expo-router 58 peers: `react-native-screens ^4.27.0`; `expo-symbols` and `@expo/ui` optional. `expo-symbols` is only required for `md` icons in Android native tabs; the template uses `NativeTabs.Trigger.VectorIcon`, so it is not needed. Root `package.json` `overrides.react-native-screens: ~4.26.0` (lock resolves 4.26.2) sits below the new peer.
- Workspace peers reject 58: `packages/ui/package.json` (`expo`, `@expo/ui`, `expo-font`, `expo-haptics` `<58.0.0`; `react-native <0.87.0`; `react-native-gesture-handler <2.33.0`) and `packages/media/package.json` (`expo`, `expo-file-system`, `expo-image-manipulator`, `expo-video` `<58.0.0`; `react-native <0.87.0`). `scripts/package-compatibility-profiles.mjs` has profiles through Expo 57; `bun run packages:peer-check` asserts every profile satisfies the declared ranges.
- Version prose: `README.md:448` and `README.md:450` ("Expo SDK 57", "React Native 0.86", "Expo Router 57") are guarded by `bun run docs:versions:check` (regex `Expo SDK (\d+)`, `React Native (\d+\.\d+)`, `Expo Router (\d+)`). `AGENTS.md:37-38` tech stack rows; `docs/migration-guide.md` baseline table (lines 25-41), `expo@^57.0.0` at line 57, tier text at line 52, snippet lines 76-78; `docs/server-guide.md:3`, lines 37-50, line 244. `llms-full.txt` and `llms-examples.txt` are generated from these docs (`bun run docs:llms`).
- React Native 0.88 removals: the repo has no `react-native/Libraries/*` deep imports, `InteractionManager`, `Touchable`, `ImageBackground`, or `NativeMethods`. Candidate breakage is the Android `StatusBar` surface (`backgroundColor`, `translucent`, `setBackgroundColor`, `setTranslucent`) in `packages/ui/src/components/StatusBar.tsx:13-24`, `client/features/media/components/VideoPlayer.tsx:112`, `client/features/media/components/ImagePreview.tsx:50`. `bun run typecheck` decides.
- `@expo/ui` 58: `<Host>` now top-aligns its content. `packages/ui/src/components/TextInput.tsx:857` wraps the native field in `<Host>`; `packages/ui/src/components/Slider.tsx:94` depends on Host width. No `backgroundOverlay`, `border(color)`, or Android `RNHostView style` usage.
- Checked and inert here: `File.write()` became async (media only reads `File.size`); expo-localization iOS RTL now follows `I18nManager` (`client/features/i18n/index.ts:50-56` already sets it explicitly); `NODE_ENV` is set before `.env` loads (only affects the `resolveUpdatesChannel` fallback in `app.config.ts`); `@expo/fingerprint` default preset is `balanced` (only matters with `EAS_PROJECT_ID`, and the native upgrade changes the runtime version anyway); R8 is on by default (`plugins/withNativeBuildSettings.js` already upserts it; keep for portability to older SDKs).
- EAS Build default image ships Xcode 26.6; SDK 58 / Xcode 27 images are "coming soon". `eas.json` pins no image. Local `bun run ios` on Xcode 27 is the iOS validation path; cloud iOS builds are not a gate here.
- Test infra: `test/setup.ts` mocks `expo.requireOptionalNativeModule` for `ExpoObserve` and mocks `@expo/ui` (`Host`, `TextInput`, `useNativeState`). jest-expo 58 may change what those mocks must cover.
- Mode is HITL because React Native 0.88 is an RC: `@sentry/react-native ~7.11.0`, `react-native-keyboard-controller 1.21.9`, `react-native-reanimated 4.5.1` / `react-native-worklets 0.10.1`, `@clerk/clerk-expo`, and `@aws-amplify/*` may lack 0.88-ready releases, and whether to pin, patch, or wait is a human call.

## Work

1. **Upgrade dependencies.** Run `bunx expo install expo@next --fix`, then `bunx expo-doctor`, and resolve every finding. Keep `react`/`react-dom` on 19.2.x. Remove `overrides.react-native-screens` from `package.json` (or set it to the version `expo install` selected) so one ≥4.27 copy resolves; confirm with `bun pm ls react-native-screens`. Commit `bun.lock`. If a native dependency has no React Native 0.88-compatible release, stop and ask before patching or pinning.
2. **Drop the router-server patch.** Delete `patches/` and the `patchedDependencies` block in `package.json`. Rewrite the "@expo/router-server bootstrap-order patch" describe in `__tests__/ssrHydration.guardrail.test.ts` to guard the upstream behavior instead: the installed `renderStreamingContent.js` contains `createInjectedScriptAsNodes` and does not match `/bootstrapScripts:\s*options\?\.assets\?\.js/`, and `package.json` has no `patchedDependencies` entry for `@expo/router-server`. Update the file's header (invariant 4) and the `app/+html.tsx` comment near line 164 to say expo-router's server renderer injects the bootstrap chunks in order.
3. **Remove the scene-lifecycle backport.** Delete `plugins/withIosSceneLifecycle.js` and its `require`, call, and comment in `app.config.ts`. Expo 58 generates `ios/<project>/SceneDelegate.swift` and the `UIApplicationSceneManifest` itself.
4. **Router config.** In `app.config.ts` remove `unstable_useServerMiddleware`; keep `origin: ""`, `unstable_useServerRendering`, `unstable_useServerDataLoaders`, and `asyncRoutes: { web: "production" }`. Refresh the comment block to say why the two remaining flags and `asyncRoutes` stay on 58.
5. **Router API adoption.** Import `NativeTabs` from `expo-router/native-tabs` in `app/(main)/(tabs)/_layout.tsx`. Rename `initialRouteName` to `anchor` in both objects in `client/config/routerSettings.ts`. Remove the `initialRouteName="(tabs)"` prop from `client/features/navigation/MainLayout.tsx` and `client/features/navigation/WebMainLayout.tsx`; the `(main)` layout's `anchor` covers it. Grep for any remaining `initialRouteName`.
6. **React Native 0.88 fallout.** Fix what `bun run typecheck` and `bun run lint` report. For the Android `StatusBar` props and setters listed in Context, delete rather than replace: edge-to-edge is already the default and the bar is translucent.
7. **Workspace peer ranges.** Widen `packages/ui/package.json` and `packages/media/package.json`: expo-family packages to `<59.0.0`, `react-native` to `<0.89.0`, and every other peer (`react-native-gesture-handler`, `react-native-screens`, `react-native-web`, `@expo/ui`, and any the new "Expo 58" profile rejects) to an upper bound that admits the version now in `bun.lock`. Add an "Expo 58" profile to both `media` and `ui` in `scripts/package-compatibility-profiles.mjs` using the exact versions in `bun.lock`. Do not bump the package versions; publishing is out of scope.
8. **Tests.** Adjust `test/setup.ts` mocks as jest-expo 58 requires. `bun run test:ci` green.
9. **CI Node.** Add `actions/setup-node@v4` with `node-version: "24"` before `oven-sh/setup-bun` in both jobs of `.github/workflows/ci.yml` so `expo` runs on a Node line SDK 58 supports.
10. **Docs and version prose.** Update `README.md:448-450` (Expo SDK 58, React Native 0.88, Expo Router 58, marked beta), `AGENTS.md:37-38`, `docs/server-guide.md` (line 3 wording: middleware no longer needs a flag, SSR and loaders still do; snippet at lines 37-40; bullets at 47-49; drop the patch from the checklist at line 244), and `docs/migration-guide.md` (baseline table, `expo@^58.0.0` at line 57, tier text at line 52, snippet at lines 76-78). Run `bun run docs:llms` and commit the regenerated `llms-full.txt` / `llms-examples.txt`.
11. **Bundle baseline.** Run `bun run build && bun run bundle-size`. If it fails only from framework growth, record before/after totals in the PR description and run `bun run bundle-size --update`.

## Validation

```bash
bun install
bunx expo-doctor
bun run verify
bun run build && bun run bundle-size
bunx expo prebuild --clean
bun run ios
bun run android   # when an emulator is available
```

Manual checks:

- Web: `bun run build && bun run start`; open `/`, `/server-alpha`, `/server-alpha/api-route`. Page source carries real route markup, `<link rel="preload" as="script">` head entries, and in-order body scripts with no `<script async>` bootstrap chunks. No hydration errors in the console. `curl -s -D - -o /dev/null http://localhost:3000/server-alpha` returns `X-Expo-Router-Middleware: 1`, proving middleware runs without the flag (use GET; the matcher in `app/+middleware.ts` does not list HEAD). `/server-alpha` renders its loader data without a client refetch error.
- Metro and export logs: no `unstable-native-tabs`, `unstable_settings.initialRouteName`, or `unstable_useServerMiddleware` warnings.
- iOS simulator on Xcode 27: app launches to the tabs (no black screen). `ios/<project>/SceneDelegate.swift` exists exactly once and subclasses Expo's `ExpoAppSceneDelegate`; `Info.plist` has `UIApplicationSceneManifest`. A cold-start deep link via `xcrun simctl openurl booted <scheme>://` lands on the route. Tabs show Feather icons. The native `@expo/ui` TextInput and Slider in the showcase render aligned after the Host top-align change.
- Android emulator, when available: app launches, tabs render with indicator pill and labels.

## Out of scope

- Publishing new `@mrmeg/expo-ui` or `@mrmeg/expo-media` versions; this spec only widens peer ranges.
- SDK 58 packages the template has no call sites for: `expo-app-intents`, Android `expo-widgets`, Expo Modules 2.0, `expo-device-hub`, `@expo/agent-cli`, tunnel v2, PostHog integration, `expo-observe`, SwiftPM builds.
- `experiments.noxcturnalTransformWorker`; evaluate once it leaves experimental.
- New `@expo/ui` navigation components (`NavigationStack`, `Toolbar`) and expo-router `screenErrorBoundary` / `activityEnabled`.
- Pinning an EAS Build image for Xcode 27; `.eas/workflows` and `eas.json` unchanged.
- Maestro E2E updates.

## Open questions

None.
