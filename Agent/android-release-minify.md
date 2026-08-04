---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/29
---

# Enable Android release minify + resource shrinking

## Goal

Turn on R8 minification and resource shrinking for Android release builds. The gradle wiring already exists but defaults off, leaving every project cut from the template shipping an unminified APK/AAB.

## Context

- `android/app/build.gradle:69`: `def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()`; lines 116–118 wire `shrinkResources` from `android.enableShrinkResourcesInReleaseBuilds` (default `'false'`) and `minifyEnabled` from the flag above, with `proguard-rules.pro` referenced on line 119.
- `android/gradle.properties` has `hermesEnabled=true`, `newArchEnabled=true`, and neither minify property.
- **`android/` and `ios/` are gitignored (`.gitignore:15-16`) and fully untracked** — this is a CNG project where the native dirs are generated artifacts. So the config plugin is the *only* place this setting can live; do **not** try to "commit" `android/gradle.properties`, and expect no git diff from the local edit.
- The repo's convention for prebuild-surviving native config is a config plugin: `plugins/withNativeBuildSettings.js` (patches `android/app/build.gradle` via `withAppBuildGradle` + writes `ios/.xcode.env` via `withDangerousMod`) and `plugins/withIosSceneLifecycle.js`. `expo/config-plugins` exports **`withGradleProperties`** — use it for the two flags rather than hand-editing text.
- `withNativeBuildSettings` is invoked from `app.config.ts:165` with a props object (`{ iosNodeOptions, androidNodeArgs }`) and reads `props.*` unguarded; any signature change must keep that call site working.
- Most Expo/RN libraries ship consumer proguard rules; the risk surface is the app's own reflection-dependent code and any library without consumer rules. Notable deps to watch in smoke testing: `@clerk/clerk-expo`, `@sentry/react-native`, `aws-amplify`, `react-native-keyboard-controller`, `react-native-reanimated` 4.5.0 / `react-native-worklets` 0.10.0.
- `android/app/proguard-rules.pro` exists (14 lines).

## Work

1. Extend `plugins/withNativeBuildSettings.js` with a `withGradleProperties` mod that upserts `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` (replace an existing entry of the same key rather than appending a duplicate; follow the plugin's existing comment/style conventions).
2. Also apply the same two lines to the local `android/gradle.properties` so the already-generated project picks them up without a full prebuild. This file is untracked, so it will not appear in the PR diff — the plugin is the shipped change.
3. If the release smoke test (below) crashes or misbehaves, add targeted keep rules to `android/app/proguard-rules.pro` with a comment naming the library each rule serves — and since that file is also regenerated, the rules must be written by the plugin (e.g. a `withDangerousMod("android")` that appends a managed block, mirroring the `.xcode.env` block markers already in the file). If no rule is needed, leave `proguard-rules.pro` alone.
4. Record before/after release AAB or APK size in the PR description.

## Validation

- `./gradlew :app:assembleRelease` from the `android/` dir succeeds.
- Install the release APK on an Android emulator (`Pixel_10` AVD is available) and smoke: cold launch past splash, the onboarding pager, then each of the four tabs — Explore (`index`), Media, Profile, Settings (`NAV_DESTINATIONS` in `client/features/navigation/navDestinations.ts`) — plus the Explore screen's Component Library link (`/(main)/(demos)/showcase`) and one screen-template card from the Explore grid, and the theme toggle. With blank `.env` auth and media are disabled (Media renders its `media-disabled` state), so this needs no secrets. If no emulator can be booted, state the exact blocker in the PR — do not claim the smoke passed.
- `bunx expo prebuild --platform android --clean` regenerates `android/gradle.properties` with both flags set, proving the plugin path works. Since `android/` is untracked there is no git diff to read — grep the regenerated file for the two keys instead. Note `--clean` also discards the local edit from Work step 2, which is expected and is exactly what proves the plugin is the source of truth.
- `bun run typecheck && bun run test:ci` (plugin change only; no test loads `app.config.ts` or the plugins, so this is a regression guard, not coverage of the change).

## Out of scope

- iOS build settings.
- Enabling separate per-ABI splits or app-bundle config changes.
- Proguard rules for auth-provider flows that need real keys (note as follow-up if suspected).

## Open questions

- None.
