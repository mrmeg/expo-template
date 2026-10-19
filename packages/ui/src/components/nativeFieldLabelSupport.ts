/**
 * Whether the native Android text field can carry its own accessible name.
 *
 * `TextInput` hides its visible label from TalkBack when the native field is
 * named from the same text, so the label is not read twice. On Android that
 * name is `semantics({ contentDescription })` (`nativeTextField.android.tsx`),
 * and `@expo/ui`'s native `SemanticsModifier` Record only gained
 * `contentDescription` in 57.0.21 (57.x) and 58.0.8 (58.x); 56.x, 57.0.0-57.0.20
 * and 58.0.0-58.0.7 drop the param without a sound. On those versions hiding
 * the label would leave TalkBack with an unnamed field and no label at all, so
 * the visible label stays readable instead. A native Record cannot be
 * feature-detected from JS, so the package names the floor, as
 * `bottomSheetHostSupport.ts` does for the sheet host.
 */

export interface ExpoUiVersion {
  major: number;
  minor: number;
  patch: number;
}

/** First 57.x release whose native `SemanticsModifier` accepts `contentDescription`. */
export const MIN_EXPO_UI_57: Readonly<ExpoUiVersion> = { major: 57, minor: 0, patch: 21 };

/** First 58.x release whose native `SemanticsModifier` accepts `contentDescription`. */
export const MIN_EXPO_UI_58: Readonly<ExpoUiVersion> = { major: 58, minor: 0, patch: 8 };

/**
 * Parses `"<major>.<minor>.<patch>"`, with an optional pre-release or build
 * suffix (`58.0.8-canary.1` reads as 58.0.8). Anything else is `undefined`.
 */
export function parseExpoUiVersion(version: unknown): ExpoUiVersion | undefined {
  if (typeof version !== "string") return undefined;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function atLeast(version: ExpoUiVersion, floor: Readonly<ExpoUiVersion>): boolean {
  if (version.minor !== floor.minor) return version.minor > floor.minor;
  return version.patch >= floor.patch;
}

/**
 * Whether this `@expo/ui` version's Android semantics modifier carries
 * `contentDescription`: 59 and later, 58.0.8 and later, 57.0.21 and later (a
 * later 57 or 58 minor counts). Anything below 57, and an unknown or
 * unparseable version, is reported unsupported, which keeps the visible label
 * readable.
 */
export function androidSemanticsHasContentDescription(version: unknown): boolean {
  const parsed = parseExpoUiVersion(version);
  if (!parsed) return false;
  if (parsed.major > 58) return true;
  if (parsed.major === 58) return atLeast(parsed, MIN_EXPO_UI_58);
  if (parsed.major === 57) return atLeast(parsed, MIN_EXPO_UI_57);
  return false;
}

/**
 * The installed `@expo/ui` version, read from the peer's `package.json` (in its
 * export map since SDK 56; Metro and Jest both resolve it through that map).
 * `undefined` when it cannot be read.
 */
export function readExpoUiVersion(): string | undefined {
  try {
    const manifest = require("@expo/ui/package.json") as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Computed once, when the module loads: the installed `@expo/ui` cannot change
 * during a session. `TextInput` keeps the visible label readable on Android
 * unless this is true.
 */
export const ANDROID_NATIVE_FIELD_IS_NAMED = androidSemanticsHasContentDescription(
  readExpoUiVersion()
);
