/**
 * The Allo Sharp faces for the default `"allo"` sans preset (Allo at its sharp roundness) — native variant.
 *
 * Exactly the four static weights `sansPresetFamilies["allo"].native`
 * points at (see `constants/fonts.ts`), each `require`d on its own so Metro
 * ships only these files. They are cut from the Allo variable font by
 * `scripts/build-allo-fonts.py` and live in `fonts/allo/native/`.
 */
import type { AlloFontMap } from "./alloFontMap";

export const alloFonts: AlloFontMap = {
  AlloSharp_400Regular: require("../fonts/allo/native/AlloSharp_400Regular.ttf"),
  AlloSharp_500Medium: require("../fonts/allo/native/AlloSharp_500Medium.ttf"),
  AlloSharp_600SemiBold: require("../fonts/allo/native/AlloSharp_600SemiBold.ttf"),
  AlloSharp_700Bold: require("../fonts/allo/native/AlloSharp_700Bold.ttf"),
};
