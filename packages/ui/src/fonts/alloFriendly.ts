/**
 * `@mrmeg/expo-ui/fonts/allo-friendly`: the native font files of the
 * `"allo-friendly"` sans preset, for an app that opts in:
 *
 *   import { alloFriendlyFonts } from "@mrmeg/expo-ui/fonts/allo-friendly";
 *   useResources({ sans: "allo-friendly", sansFonts: alloFriendlyFonts });
 *
 * A separate entry so an app on the default sans never bundles these files.
 * On web the map is empty: the preset's stylesheet serves the faces.
 */
export { alloFriendlyFonts } from "../lib/alloFriendlyFonts";
export type { AlloFontMap } from "../lib/alloFontMap";
