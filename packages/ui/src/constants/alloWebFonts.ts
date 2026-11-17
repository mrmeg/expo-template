import type { SansPreset } from "./fonts";

/** The three sans presets the bundled Allo cuts serve. */
export type AlloPreset = Extract<SansPreset, "allo" | "allo-friendly" | "allo-round">;

/**
 * The `id` of the `<style>` or `<link>` element that carries each sans
 * preset's web faces. `useResources` and `loadSansPreset` look for it before
 * injecting the preset's stylesheet, so a host that self-hosts the faces in an
 * element with this id (see `getAlloFontFaceCss`) never loads them twice.
 */
export const sansStylesheetIds: Record<SansPreset, string> = {
  allo: "mrmeg-expo-ui-allo",
  "allo-friendly": "mrmeg-expo-ui-allo-friendly",
  "allo-round": "mrmeg-expo-ui-allo-round",
  geist: "mrmeg-expo-ui-geist",
  inter: "mrmeg-expo-ui-inter",
};

/**
 * The web files of each Allo cut, in `fonts/allo/web/` of the package
 * (`node_modules/@mrmeg/expo-ui/dist/fonts/allo/web/` in an app). Each cut is
 * a weight-variable font (400 to 700) split in two by unicode range, so a page
 * in English downloads only the Latin file.
 */
export const alloWebFonts: Record<AlloPreset, { family: string; latin: string; ext: string }> = {
  allo: { family: "Allo Sharp", latin: "allo-sharp-latin.woff2", ext: "allo-sharp-ext.woff2" },
  "allo-friendly": { family: "Allo Friendly", latin: "allo-friendly-latin.woff2", ext: "allo-friendly-ext.woff2" },
  "allo-round": { family: "Allo Round", latin: "allo-round-latin.woff2", ext: "allo-round-ext.woff2" },
};

/**
 * The unicode range each web file covers (`fonts/allo/web/ranges.json`, which
 * `constants/__tests__/alloWebFonts.test.ts` holds this copy to). `latin` is
 * the range Google Fonts serves as Latin; `ext` is every other glyph in Allo:
 * Latin Extended, Vietnamese, currency, arrows, and the interface symbols.
 */
export const alloUnicodeRanges = {
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329," +
    "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  ext:
    "U+0100-0130,U+0132-0148,U+014A-0151,U+0154-017F,U+0192,U+01A0-01A1,U+01AF-01B0,U+0218-021B," +
    "U+0237,U+02C4-02C5,U+02DD,U+02E2,U+02EE,U+0300-0303,U+0306-0307,U+0309-030A,U+030C,U+031B," +
    "U+0323,U+0327-0328,U+0E3F,U+1D43,U+1D49,U+1D52,U+1D58,U+1E24-1E25,U+1E36-1E37,U+1E9E," +
    "U+1EA0-1EF9,U+2070,U+2074-2079,U+2080-2089,U+20A6,U+20A9-20AB,U+20B1,U+20B4,U+20B9-20BA,U+20BD," +
    "U+20BF,U+2103,U+2109,U+2116,U+2153-2154,U+215B-215E,U+2190,U+2192,U+2194-2199,U+21A9,U+21B5," +
    "U+21BA-21BB,U+21D0,U+21D2,U+21D4,U+21E5,U+21E7,U+221E,U+2248,U+2260,U+2264-2265,U+22EF," +
    "U+2303-2304,U+2315,U+2318,U+2325-2326,U+232B,U+238B,U+23CE,U+2423,U+25A0-25A1,U+25B2,U+25B4," +
    "U+25B6,U+25B8,U+25BC,U+25BE,U+25C0,U+25C2,U+25C6,U+25CB,U+25CF,U+2605,U+2665,U+26A0,U+2713," +
    "U+2715,U+2717,U+276E-276F,U+E00C-E00D,U+E011-E018,U+E01C-E01D,U+E02C-E033,U+E035-E03A,U+E03C," +
    "U+E03F,U+E041-E042,U+E044-E045,U+E047,U+E04A,U+E04C,U+E050-E051,U+E055-E058,U+E06B,U+E06E-E07B," +
    "U+E07E-E08C,U+E092,U+E097-E0A4,U+E0B4-E0BD,U+E0DC-E0E5,U+E1D2,U+E1D5,U+E1D7,U+E1DA,U+E1DC," +
    "U+E1DE,U+E1E1,U+EE07,U+EE90,U+EE9F,U+EEA1-EEA3,U+EED6,U+EEDE,U+EEE0-EEE1,U+F6C3",
} as const;

/**
 * The version of `@mrmeg/expo-ui` whose published Allo web files the fallback
 * stylesheet below points at. It moves only when `fonts/allo/web/` changes.
 */
export const ALLO_WEB_FONTS_VERSION = "0.39.0";

/**
 * The stylesheet `useResources` injects for an Allo preset when the document
 * has no element with the preset's id: the package's own published CSS on
 * jsDelivr. A production web app should self-host instead (`getAlloFontFaceCss`).
 */
export function getAlloStylesheetUrl(preset: AlloPreset): string {
  const slug = alloWebFonts[preset].latin.replace("-latin.woff2", "");
  return `https://cdn.jsdelivr.net/npm/@mrmeg/expo-ui@${ALLO_WEB_FONTS_VERSION}/dist/fonts/allo/web/${slug}.css`;
}

export type AlloFontFaceOptions = {
  /** Where the copied `.woff2` files are served from. Default `"/fonts/allo"`. */
  baseUrl?: string;
  /**
   * `font-display`. Default `"optional"`: with the Latin file preloaded the
   * face renders from the first frame, and a late arrival never swaps in
   * (no layout shift). Use `"swap"` for a preset that is switched to at runtime.
   */
  display?: "optional" | "swap" | "fallback" | "block" | "auto";
};

/**
 * The `@font-face` rules that self-host one Allo cut. Copy the preset's two
 * files from the package's `fonts/allo/web/` into the app's public folder and
 * put the rules in the document head, in an element with the preset's id:
 *
 *   <link rel="preload" href="/fonts/allo/allo-sharp-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
 *   <style id={sansStylesheetIds.allo}>{getAlloFontFaceCss("allo")}</style>
 *
 * A pure string, safe to call while server rendering.
 */
export function getAlloFontFaceCss(preset: AlloPreset = "allo", options: AlloFontFaceOptions = {}): string {
  const { baseUrl = "/fonts/allo", display = "optional" } = options;
  const { family, latin, ext } = alloWebFonts[preset];
  const face = (file: string, unicodeRange: string) =>
    `@font-face{font-family:"${family}";font-style:normal;font-weight:400 700;font-display:${display};src:url(${baseUrl}/${file}) format("woff2");unicode-range:${unicodeRange}}`;
  return [face(ext, alloUnicodeRanges.ext), face(latin, alloUnicodeRanges.latin)].join("\n");
}
