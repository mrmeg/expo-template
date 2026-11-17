/**
 * `alloWebFonts.ts` describes the committed Allo web files
 * (`fonts/allo/web/`, built by `scripts/build-allo-fonts.py`) in code, so a
 * host can self-host them (`getAlloFontFaceCss`) or fall back to the
 * package's published CSS (`getAlloStylesheetUrl`). These tests hold the code
 * to the files: the unicode ranges, the file names, and the `@font-face`
 * rules the published stylesheets carry.
 */
import fs from "fs";
import path from "path";

import {
  ALLO_WEB_FONTS_VERSION,
  alloUnicodeRanges,
  alloWebFonts,
  getAlloFontFaceCss,
  getAlloStylesheetUrl,
  sansStylesheetIds,
  type AlloPreset,
} from "../alloWebFonts";
import { sansPresetFamilies } from "../fonts";

const webDir = path.join(__dirname, "..", "..", "fonts", "allo", "web");
const packageJsonPath = path.join(__dirname, "..", "..", "..", "package.json");

const ALLO_PRESETS: AlloPreset[] = ["allo", "allo-friendly", "allo-round"];

/** The `@font-face` rules of a stylesheet, one per entry, comments and separators dropped. */
function fontFaceRules(css: string): string[] {
  return [...css.matchAll(/@font-face\{[^}]*\}/g)].map((match) => match[0]);
}

/** `[major, minor, patch]` of a plain `x.y.z` version. */
function semverParts(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`not a plain x.y.z version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe("alloWebFonts", () => {
  it("holds the same unicode ranges as fonts/allo/web/ranges.json", () => {
    const ranges = JSON.parse(fs.readFileSync(path.join(webDir, "ranges.json"), "utf8"));
    expect(alloUnicodeRanges).toEqual(ranges);
  });

  it("names only files that exist in fonts/allo/web", () => {
    for (const preset of ALLO_PRESETS) {
      const { latin, ext } = alloWebFonts[preset];
      expect(fs.existsSync(path.join(webDir, latin))).toBe(true);
      expect(fs.existsSync(path.join(webDir, ext))).toBe(true);
    }
  });

  it.each(ALLO_PRESETS)("getAlloFontFaceCss(%s) writes the rules of the published stylesheet", (preset) => {
    const slug = alloWebFonts[preset].latin.replace("-latin.woff2", "");
    const published = fs.readFileSync(path.join(webDir, `${slug}.css`), "utf8");
    const generated = getAlloFontFaceCss(preset, { baseUrl: ".", display: "swap" });

    // The published file has one comment line ahead of the rules.
    expect(published.trimStart().startsWith("/*")).toBe(true);
    expect(fontFaceRules(published)).toHaveLength(2);
    expect(fontFaceRules(generated)).toEqual(fontFaceRules(published));
  });

  it("defaults to /fonts/allo, font-display:optional, the 400 to 700 weight axis, and the Allo Sharp family", () => {
    const rules = fontFaceRules(getAlloFontFaceCss());
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule).toContain("font-family:\"Allo Sharp\"");
      expect(rule).toContain("font-display:optional");
      expect(rule).toContain("font-weight:400 700");
      expect(rule).toContain("font-style:normal");
    }
    expect(rules[0]).toContain("src:url(/fonts/allo/allo-sharp-ext.woff2) format(\"woff2\")");
    expect(rules[0]).toContain(`unicode-range:${alloUnicodeRanges.ext}`);
    expect(rules[1]).toContain("src:url(/fonts/allo/allo-sharp-latin.woff2) format(\"woff2\")");
    expect(rules[1]).toContain(`unicode-range:${alloUnicodeRanges.latin}`);
  });

  it.each<[AlloPreset, string]>([
    ["allo", "Allo Sharp"],
    ["allo-friendly", "Allo Friendly"],
    ["allo-round", "Allo Round"],
  ])("serves the %s preset as the %s family the web stack names", (preset, family) => {
    expect(alloWebFonts[preset].family).toBe(family);
    for (const rule of fontFaceRules(getAlloFontFaceCss(preset))) {
      expect(rule).toContain(`font-family:"${family}"`);
    }
    expect(sansPresetFamilies[preset].web.startsWith(`"${family}",`)).toBe(true);
  });

  it("points the fallback stylesheet at this package's published files on jsDelivr", () => {
    expect(getAlloStylesheetUrl("allo-round")).toBe(
      `https://cdn.jsdelivr.net/npm/@mrmeg/expo-ui@${ALLO_WEB_FONTS_VERSION}/dist/fonts/allo/web/allo-round.css`,
    );
    expect(getAlloStylesheetUrl("allo")).toMatch(/\/dist\/fonts\/allo\/web\/allo-sharp\.css$/);
    expect(getAlloStylesheetUrl("allo-friendly")).toMatch(/\/dist\/fonts\/allo\/web\/allo-friendly\.css$/);
  });

  it("pins a published version no newer than this package", () => {
    const { version } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version: string };
    const [major, minor, patch] = semverParts(ALLO_WEB_FONTS_VERSION);
    const [pkgMajor, pkgMinor, pkgPatch] = semverParts(version);

    const pinned = major * 1e6 + minor * 1e3 + patch;
    const current = pkgMajor * 1e6 + pkgMinor * 1e3 + pkgPatch;
    expect(pinned).toBeLessThanOrEqual(current);
  });

  it("gives every sans preset its own stylesheet id", () => {
    const presets = Object.keys(sansPresetFamilies).sort();
    expect(Object.keys(sansStylesheetIds).sort()).toEqual(presets);
    const ids = Object.values(sansStylesheetIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
