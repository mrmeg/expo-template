import { Platform } from "react-native";

/**
 * Android `BottomSheet` keyboard avoidance is platform-owned, and the part the
 * package depends on lives in the host: Material3's `ModalBottomSheet` shrinks
 * the sheet with `imePadding()`, `@expo/ui`'s `RNHostView` re-reports its
 * Compose size to the shadow tree (`onSizeChanged` → `ShadowNodeProxy.setViewSize`),
 * and the `flexGrow: 1, height: 0` column the host wraps our children in
 * follows. `expo-modules-core` <= 57.0.3 flushed that report only from a
 * one-shot pre-draw listener on the activity window, which does not draw while
 * the sheet's own dialog window animates the IME, so the column kept its
 * detent height and `Footer` sat under the keyboard until the activity redrew
 * (expo/expo#47778, fixed by expo/expo#47810 in 57.0.4 and 58.0.0; no 56.x
 * release has it). Nothing in JS can observe a size the shadow tree never
 * received, so the package names the floor instead: once per session, in dev,
 * on Android, when the *native* core compiled into the app is older.
 */

export interface ExpoModulesCoreVersion {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

/** First `expo-modules-core` release whose `RNHostView` size flush always lands. */
export const MIN_EXPO_MODULES_CORE: Readonly<Omit<ExpoModulesCoreVersion, "version">> = {
  major: 57,
  minor: 0,
  patch: 4,
};

/**
 * The native `expo-modules-core` version compiled into the running app, as the
 * core's own `CoreModule` publishes it on `globalThis.expo` (Android and iOS,
 * since SDK 50). `undefined` on web, in Jest, or when the core is not loaded.
 */
export function readExpoModulesCoreVersion(): ExpoModulesCoreVersion | undefined {
  const expo = (globalThis as { expo?: { expoModulesCoreVersion?: unknown } }).expo;
  const candidate = expo?.expoModulesCoreVersion;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof (candidate as ExpoModulesCoreVersion).major !== "number" ||
    typeof (candidate as ExpoModulesCoreVersion).minor !== "number" ||
    typeof (candidate as ExpoModulesCoreVersion).patch !== "number"
  ) {
    return undefined;
  }
  return candidate as ExpoModulesCoreVersion;
}

/**
 * Whether this core drops the sheet host's size update when the keyboard opens:
 * a defined version lexicographically below {@link MIN_EXPO_MODULES_CORE}.
 * An unknown version is not reported as broken.
 */
export function bottomSheetHostDropsResize(
  version: ExpoModulesCoreVersion | undefined
): boolean {
  if (!version) return false;
  const { major, minor, patch } = MIN_EXPO_MODULES_CORE;
  if (version.major !== major) return version.major < major;
  if (version.minor !== minor) return version.minor < minor;
  return version.patch < patch;
}

export function bottomSheetHostWarning(version: ExpoModulesCoreVersion): string {
  const { major, minor, patch } = MIN_EXPO_MODULES_CORE;
  return (
    `@mrmeg/expo-ui BottomSheet: expo-modules-core ${version.version} drops the sheet's ` +
    "size update when the keyboard opens on Android, so BottomSheet.Footer and the tail " +
    "of Body end up under the keyboard (expo/expo#47778). Update expo-modules-core to " +
    `>= ${major}.${minor}.${patch} (fixed in 57.0.4 / 58.0.0) and rebuild the app.`
  );
}

let warned = false;

/**
 * Warn once per JS session, in development, on Android, when the native
 * `expo-modules-core` is older than {@link MIN_EXPO_MODULES_CORE}. Called when a
 * `BottomSheet.Content` mounts. Silent on iOS and web, where the sheet's
 * avoidance does not go through `RNHostView`'s size state.
 */
export function warnIfBottomSheetHostDropsResize(): void {
  if (warned || !__DEV__ || Platform.OS !== "android") return;
  const version = readExpoModulesCoreVersion();
  if (!version || !bottomSheetHostDropsResize(version)) return;
  warned = true;
  console.warn(bottomSheetHostWarning(version));
}

/** Test hook: forget that the warning was already shown. */
export function resetBottomSheetHostWarningForTests(): void {
  warned = false;
}
