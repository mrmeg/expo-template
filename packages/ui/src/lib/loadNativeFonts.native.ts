/**
 * Registers font files through `expo-font` — native variant. See
 * `loadNativeFonts.ts` for why this is split by platform.
 */
import { loadAsync } from "expo-font";

import type { NativeFontMap } from "./loadNativeFonts";

export type { NativeFontMap };

export function loadNativeFonts(fonts: NativeFontMap): Promise<void> {
  return loadAsync(fonts);
}
