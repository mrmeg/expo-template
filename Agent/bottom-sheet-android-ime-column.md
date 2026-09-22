---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/102
---

# Android `BottomSheet`: the hosted column must follow the IME-shrunk Material window

## Goal

With a `TextInput` focused inside `BottomSheet.Body` on Android, `BottomSheet.Footer` and the tail of `Body` stay above the keyboard on a fresh open, with `Body` scrolling. Establish where that size signal actually flows, prove it on the template harness, make the package name the host requirement it depends on (and tell a consumer in dev when it is not met), and correct the 0.27.0 CHANGELOG claim that "Material owns Android avoidance". No version bump.

## Context

Verified on `dev` at e6bc3c8 (`@mrmeg/expo-ui` 0.27.0 published this morning, PR #100).

- **Report.** tractor-tools-direct PR #32 (2026-09-22, `Pixel_10` API 36, `@mrmeg/expo-ui` 0.27.0, `@expo/ui` 57.0.4, Expo 57): focusing any field in a sheet shrinks the Material3 `ModalBottomSheet` window to the IME top (uiautomator host bounds 0.919 → 0.577 of the screen) but the hosted RN column keeps its detent height, so `Footer` is clipped below the keyboard and `Body` shows a blank strip instead of scrolling. Backgrounding the activity with the IME up and resuming re-laid the column out in 3 of 5 tries. iOS is correct. Same signature in every sheet, every snap point.
- **How the column gets its height (`@expo/ui` 58.0.2, identical in 57).** `node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.android.tsx:216-227` renders `Host > ModalBottomSheet > RNHostView` and wraps our children in `{ flexGrow: 1, height: 0 }`, so the column is exactly the `RNHostView` shadow node's height. That node has no style height: `node_modules/@expo/ui/android/src/main/java/expo/modules/ui/RNHostView.kt:152-158, 227-238` gives the hosted `AndroidView` `Modifier.fillMaxSize()` plus `onSizeChanged { shadowNodeProxy.setViewSize(w, h) }`. Material3 (`material3:1.5.0-alpha17`, `@expo/ui/android/build.gradle:43`) wraps the sheet in `Modifier.fillMaxSize().imePadding()`, so the IME genuinely shrinks the Compose box and `onSizeChanged` fires with the reduced height. `setViewSize` becomes a Fabric state update (`expo-modules-core/android/src/main/cpp/fabric/NativeStatePropsGetter.cpp:47-61`) that `ExpoViewComponentDescriptor.h:59-82` turns into `snode->setSize({w, h})` on re-adopt, dirtying Yoga so the column re-lays out. The signal exists and is complete; the package needs no inset and no measurement.
- **Where it was dropped.** `expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ShadowNodeProxy.kt` `scheduleFlush` applied the pending size in a one-shot `OnPreDrawListener` on the `RNHostView`'s own `ViewTreeObserver`. `RNHostView` is a `GONE` child of the `Host` in the **activity** window (`ExpoComposeView.kt:216-218, 280-287`), while the sheet draws in its own dialog window, so the activity never draws during the IME animation and the listener never fires — until something redraws the activity (background/resume, exactly tractor's recovery). Upstream fixed this in expo/expo#47810 for issue #47778 ("Compose-hosted React Native content keeping a stale size after a rapid resize such as dismissing the software keyboard"): the flush is also `view.post`ed so the latest size always lands. It shipped in **expo-modules-core 57.0.4 (2026-07-15)** and 58.0.0; there is no 56.x backport (sdk-56 CHANGELOG has no #47778). tractor's `bun.lock:1367` resolves `expo-modules-core@57.0.3` (`expo@57.0.4` depends on `~57.0.3`), which has no `flushRunnable`; the template has 58.0.2, which does.
- **A JS signal exists for the requirement.** `globalThis.expo.expoModulesCoreVersion` (`{ version, major, minor, patch }`, Android + iOS, declared in `expo-modules-core/src/ts-declarations/global.ts:58-65`, present on the sdk-56 and sdk-57 branches too) reports the **native** core version compiled into the app, which is the one that matters here (a `node_modules` bump without a native rebuild still has the bug). The package imports nothing new to read it, so `packages:peer-check` is unaffected.
- **Package today.** `packages/ui/src/components/BottomSheet.tsx:35-45` (header) and `:578-591` (`BottomSheetContent` Android comment) say Material owns Android avoidance and "no JS keyboard signal exists inside the Compose dialog window"; `packages/ui/README.md:576-586`, `packages/ui/LLM_USAGE.md:84-95` and `packages/ui/CHANGELOG.md` `## [0.27.0]` "`BottomSheet.Content avoidKeyboard` is documented as platform-owned" repeat it. `packages/ui/package.json` has no `expo-modules-core` peer (it is `expo`'s dependency); the peer profiles in `scripts/package-compatibility-profiles.mjs:60+` still include Expo 56.
- **Harness.** The template app has no committed sheet-with-form demo (`client/showcase/details.tsx:206-238` are Body-only sheets); PR #97 used a temporary, uncommitted lab route. `android/app/build/outputs/apk/debug/app-debug.apk` is from 2026-09-17 and predates the `react-native-svg` native dependency (0.26.0, 2026-09-18): a fresh `expo run:android` debug build is required.

**Decision (night mode).** The package adds no height plumbing of its own. Owning the Android sheet composition to read a Compose `onSizeChanged` modifier into a JS `height` would fork ~200 lines of `@expo/ui` per SDK to duplicate a signal the host already delivers on a fixed core, and a `Keyboard`/`onLayout` fallback cannot observe a size the shadow tree never received. The durable fix is the host floor, stated and enforced where the consumer will see it: a one-time dev warning on Android when the native `expo-modules-core` is older than 57.0.4, plus docs and CHANGELOG. Do not add an `expo-modules-core` peer range: the Expo 56 profile would fail and 56 has no fixed release; the warning covers 56 consumers honestly. Expo 56 stays supported for everything else.

## Work

1. `packages/ui/src/components/bottomSheetHostSupport.ts` (new, no imports):
   - `MIN_EXPO_MODULES_CORE = { major: 57, minor: 0, patch: 4 }` and `readExpoModulesCoreVersion()` returning `globalThis.expo?.expoModulesCoreVersion` typed locally (`{ version: string; major: number; minor: number; patch: number } | undefined`).
   - `bottomSheetHostDropsResize(version)`: `true` when `version` is defined and `(major, minor, patch)` is lexicographically below the minimum.
   - `warnIfBottomSheetHostDropsResize()`: Android only (`Platform.OS === "android"` — import `Platform` from `react-native`), `__DEV__` only, once per JS session (module-level flag, exported `resetBottomSheetHostWarningForTests()`); `console.warn` text: `@mrmeg/expo-ui BottomSheet: expo-modules-core <version> drops the sheet's size update when the keyboard opens on Android, so BottomSheet.Footer and the tail of Body end up under the keyboard (expo/expo#47778). Update expo-modules-core to >= 57.0.4 (fixed in 57.0.4 / 58.0.0) and rebuild the app.`
2. `packages/ui/src/components/BottomSheet.tsx`:
   - `BottomSheetContent`: `useEffect(() => { warnIfBottomSheetHostDropsResize(); }, [])` at mount.
   - Header comment `:35-45` and the Android paragraph in `BottomSheetContent` (`:578-591`): replace "Material3's `ModalBottomSheet` owns it (no JS keyboard signal exists inside the Compose dialog window)" with the verified chain: Material shrinks the sheet with `imePadding`, `RNHostView` re-reports its Compose size to the shadow node, the `flexGrow: 1, height: 0` column follows; this needs `expo-modules-core` ≥ 57.0.4 (expo#47778/#47810), and the package warns in dev below it. Keep "never nest a `KeyboardAvoidingView` in a sheet".
3. Tests:
   - `packages/ui/src/components/__tests__/bottomSheetHostSupport.test.ts`: `bottomSheetHostDropsResize` → `true` for 57.0.3 and 56.0.26, `false` for 57.0.4, 57.1.0, 58.0.2, `undefined`; `warnIfBottomSheetHostDropsResize` on Android with `globalThis.expo = { expoModulesCoreVersion: { version: "57.0.3", major: 57, minor: 0, patch: 3 } }` warns once (message contains `57.0.3`, `57.0.4`, `47778`) and not again on a second call; on iOS with the same version it does not warn; on Android with 58.0.2 it does not warn. Restore `globalThis.expo` and `Platform.OS` in `afterEach`.
   - `packages/ui/src/components/__tests__/BottomSheet.test.tsx`: one case rendering `<BottomSheet open><BottomSheet.Content>…</BottomSheet.Content></BottomSheet>` with `Platform.OS = "android"` and the stale version installed on `globalThis.expo` → `console.warn` called once with the message; the existing "Android column has no `paddingBottom`" case stays.
4. Docs:
   - `packages/ui/README.md:576-586` `BottomSheet` bullet and `packages/ui/LLM_USAGE.md:84-95`: state the Android chain and the `expo-modules-core` ≥ 57.0.4 requirement (`npx expo install --fix` or `bun update expo-modules-core`, then rebuild the app); mention the dev warning. Run `bun run docs:llms`; commit the regenerated `packages/ui/llms-full.md` / `llms.txt` if they change.
   - `packages/ui/CHANGELOG.md`: add `## [0.27.1]` under `## [Unreleased]` (unreleased; **do not** change `packages/ui/package.json` `version`) with `### Fixed`: "**Android `BottomSheet` names the host requirement its keyboard avoidance depends on.** 0.27.0 said Material owns Android avoidance; that is true for the window and, on `expo-modules-core` ≥ 57.0.4, for the hosted column too, because `RNHostView` re-reports its Compose size to the shadow tree when the sheet shrinks for the IME. `expo-modules-core` ≤ 57.0.3 dropped that update until the activity redrew (expo/expo#47778, fixed by #47810 in 57.0.4 / 58.0.0), which is the clipped `Footer` tractor-tools-direct #32 saw on Expo 57 with core 57.0.3. The package now warns once in dev on Android when the native core is older, and the docs state the floor. No 56.x release has the fix." Reference the device evidence in the PR, not the changelog.
5. Device proof on the template app (worktree, `Pixel_10_sheetime` AVD or another private copy; debug `expo run:android` under the native-build slot; Metro from the worktree), with a temporary uncommitted lab route (`app/(main)/(demos)/sheet-ime-lab.tsx`) rendering three sheets: 45% and 92% with `Handle` + `Header` + `Body` (`TextInput` ×2 + filler) + `Footer` button, and 92% with a 12-row `Body`. Record in the PR (frames from argent `describe`, screenshots stay out of the repo):
   - Fresh open → focus a `Body` field: the `Footer` button's frame bottom sits above the IME top; `Body` scrolls to its last row; 3 consecutive fresh opens.
   - Home → resume with the IME up: still correct. Dismiss the keyboard: the column grows back to the detent.
   - Root-cause confirmation: in the worktree's `node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ShadowNodeProxy.kt`, temporarily remove the `view.removeCallbacks(flushRunnable); view.post(flushRunnable)` fallback (the #47810 change), rebuild (incremental), and reproduce the clipped `Footer` on a fresh open; restore the file, rebuild, re-verify. This is the only evidence that ties tractor's symptom to the core version; do it, and mention if the pre-fix build does not reproduce.
   - iOS and web: no code path changes (`warnIfBottomSheetHostDropsResize` is Android-gated, the column style is untouched); the unit tests assert iOS silence. No iOS device run is required for this spec; say so in the PR.

## Validation

- `bun run ui:typecheck`, `bun run ui:test`, `bun run ui:build`, `bun run packages:peer-check`, `bun run ui:consumer-smoke` (if it runs locally).
- Root: `bun run typecheck`, `bun run lint`, `bun run test:ci -- --maxWorkers=2`, `bun run docs:llms:check`.
- `bunx jest packages/ui/src/components/__tests__/BottomSheet packages/ui/src/components/__tests__/bottomSheetHostSupport` green.
- Device evidence in the PR as in Work 5.

### Downstream

- tractor-tools-direct `Agent/sheet-and-auth-form-keyboard-avoidance.md` (blocked on this package): the unblock is `expo-modules-core` ≥ 57.0.4 in its lockfile (`bun update expo-modules-core` → 57.0.18) plus a dev-client rebuild; 0.27.1 adds the warning that would have named this, not a behavior change. Re-run its Work step 2 after both.
- fieldnest `Agent/start-trip-modal-keyboard-avoidance.md` targets `Dialog`/`DialogContent` (portal + `FullWindowOverlay`, not the Material sheet); nothing here changes that path. It stays blocked on its own items.

## Out of scope

- Forking `@expo/ui`'s Android sheet composition or adding a JS `height`/inset fallback for the column.
- `avoidKeyboard` semantics, iOS or web sheet behavior, `Dialog` keyboard avoidance.
- Adding an `expo-modules-core` peer range or dropping the Expo 56 profile.
- Version bump or publish (Matt approves separately).

## Open questions

None.
