/**
 * The Allo Friendly faces for the opt-in `"allo-friendly"` sans preset (Allo at roundness 50) — native variant.
 *
 * Exactly the four static weights `sansPresetFamilies["allo-friendly"].native`
 * points at (see `constants/fonts.ts`), each `require`d on its own so Metro
 * ships only these files. They are cut from the Allo variable font by
 * `scripts/build-allo-fonts.py` and live in `fonts/allo/native/`.
 */
import type { AlloFontMap } from "./alloFontMap";

export const alloFriendlyFonts: AlloFontMap = {
  AlloFriendly_400Regular: require("../fonts/allo/native/AlloFriendly_400Regular.ttf"),
  AlloFriendly_500Medium: require("../fonts/allo/native/AlloFriendly_500Medium.ttf"),
  AlloFriendly_600SemiBold: require("../fonts/allo/native/AlloFriendly_600SemiBold.ttf"),
  AlloFriendly_700Bold: require("../fonts/allo/native/AlloFriendly_700Bold.ttf"),
};
