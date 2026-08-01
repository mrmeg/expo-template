---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Enable Android release minify + resource shrinking

## Goal

Turn on R8 minification and resource shrinking for Android release builds. The wiring already exists but defaults off, leaving every project cut from the template shipping an unminified APK/AAB.

## Context

- `android/app/build.gradle:69`: `enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false)`; lines 116–118 wire `shrinkResources` from `android.enableShrinkResourcesInReleaseBuilds` (default `'false'`) and `minifyEnabled` from the flag above, with `proguard-rules.pro` already referenced.
- `android/gradle.properties` has `hermesEnabled=true`, `newArchEnabled=true`, and neither minify property.
- The `android/` dir is committed, but `expo prebuild --clean` regenerates it — the repo's convention for prebuild-surviving native config is a config plugin (`plugins/withNativeBuildSettings.js` already writes gradle-adjacent settings; `plugins/withIosSceneLifecycle.js` same pattern).
- Most Expo/RN libraries ship consumer proguard rules; the risk surface is the app's own reflection-dependent code and any library without consumer rules. Notable deps to watch in smoke testing: Clerk, Sentry, aws-amplify, keyboard-controller, reanimated/worklets.

## Work

1. Extend `plugins/withNativeBuildSettings.js` to set `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` in `gradle.properties` during prebuild (follow the plugin's existing style), and set the same two lines in the committed `android/gradle.properties` so non-prebuild builds match.
2. If the release smoke test (below) crashes or misbehaves, add targeted keep rules to `android/app/proguard-rules.pro` with a comment naming the library each rule serves; if a rule is needed, also ensure prebuild regeneration preserves it (extend the plugin) — otherwise leave `proguard-rules.pro` untouched.
3. Record before/after release AAB or APK size in the PR description.

## Validation

- `cd android && ./gradlew :app:assembleRelease` succeeds (quote any paths with parentheses).
- Install the release APK on an Android emulator and smoke: cold launch past splash, onboarding, each tab, showcase list + one template, theme toggle. With blank `.env` (auth disabled) this needs no secrets. If no Android emulator is available in the implementation environment, state the exact blocker in the PR — do not claim the smoke passed.
- `bunx expo prebuild --platform android --clean` (in a scratch copy or with a clean git tree to diff) regenerates `gradle.properties` with both flags set, proving the plugin path works. Restore the tree afterward.
- `bun run typecheck && bun run test:ci` (plugin change only; should be unaffected).

## Out of scope

- iOS build settings.
- Enabling separate per-ABI splits or app-bundle config changes.
- Proguard rules for auth-provider flows that need real keys (note as follow-up if suspected).

## Open questions

- None.
