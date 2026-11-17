/**
 * `@mrmeg/expo-ui/fonts/allo-round`: the native font files of the
 * `"allo-round"` sans preset, for an app that opts in:
 *
 *   import { alloRoundFonts } from "@mrmeg/expo-ui/fonts/allo-round";
 *   useResources({ sans: "allo-round", sansFonts: alloRoundFonts });
 *
 * A separate entry so an app on the default sans never bundles these files.
 * On web the map is empty: the preset's stylesheet serves the faces.
 */
export { alloRoundFonts } from "../lib/alloRoundFonts";
export type { AlloFontMap } from "../lib/alloFontMap";
