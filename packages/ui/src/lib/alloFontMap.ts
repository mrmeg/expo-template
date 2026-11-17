/**
 * A map of `expo-font` family names to bundled font assets: the shape
 * `useResources({ sansFonts })` and `loadSansPreset(preset, fonts)` take.
 * Empty on web, where the faces come from a stylesheet.
 */
export type AlloFontMap = Readonly<Record<string, number>>;
