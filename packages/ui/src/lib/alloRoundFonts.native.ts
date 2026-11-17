/**
 * The Allo Round faces for the opt-in `"allo-round"` sans preset (Allo at roundness 100) — native variant.
 *
 * Exactly the four static weights `sansPresetFamilies["allo-round"].native`
 * points at (see `constants/fonts.ts`), each `require`d on its own so Metro
 * ships only these files. They are cut from the Allo variable font by
 * `scripts/build-allo-fonts.py` and live in `fonts/allo/native/`.
 */
import type { AlloFontMap } from "./alloFontMap";

export const alloRoundFonts: AlloFontMap = {
  AlloRound_400Regular: require("../fonts/allo/native/AlloRound_400Regular.ttf"),
  AlloRound_500Medium: require("../fonts/allo/native/AlloRound_500Medium.ttf"),
  AlloRound_600SemiBold: require("../fonts/allo/native/AlloRound_600SemiBold.ttf"),
  AlloRound_700Bold: require("../fonts/allo/native/AlloRound_700Bold.ttf"),
};
