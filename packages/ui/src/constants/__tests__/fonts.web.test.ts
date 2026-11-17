/**
 * Web resolves weight numerically on one multi-weight family (the package's
 * "numeric" strategy). Italic therefore rides on `fontStyle` — Google Fonts
 * serves the real 400 italic for Inter and Newsreader from the stylesheets
 * `useResources` injects, and the browser synthesizes the rest (Allo and
 * Geist ship no italic at all).
 */
import "../../components/__tests__/forceWebPlatform";

import {
  fontFamilies,
  interFamilies,
  newsreaderFamilies,
  resolveFontStyle,
  sansPresetFamilies,
  type SansPreset,
} from "../fonts";

describe("resolveFontStyle (web)", () => {
  it("defaults to Allo Sharp + numeric weight, Georgia stack for serif", () => {
    expect(resolveFontStyle({}, "sansSerif", "semibold")).toEqual({
      fontFamily: expect.stringMatching(/^"Allo Sharp", system-ui,/),
      fontWeight: "600",
    });
    expect(fontFamilies.sansSerif.regular).toBe(sansPresetFamilies.allo.web);
    // The explicit default is the same as no preset.
    expect(resolveFontStyle({}, "sansSerif", "bold", { sansPreset: "allo" })).toEqual(resolveFontStyle({}, "sansSerif", "bold"));
    expect(resolveFontStyle({}, "serif", "regular")).toEqual({
      fontFamily: expect.stringContaining("Georgia"),
      fontWeight: "400",
    });
  });

  it("italic adds fontStyle and keeps the numeric weight", () => {
    expect(resolveFontStyle({}, "sansSerif", "medium", { italic: true })).toEqual({
      fontFamily: expect.stringMatching(/^"Allo Sharp",/),
      fontWeight: "500",
      fontStyle: "italic",
    });
  });

  it("an app italic face replaces the family and drops fontStyle, weight still numeric", () => {
    const overrides = { families: { sansSerif: { regular: "Brand", italic: { regular: "Brand Italic" } } } };
    expect(resolveFontStyle(overrides, "sansSerif", "bold", { italic: true })).toEqual({
      fontFamily: "Brand Italic",
      fontWeight: "700",
    });
    // The "family" strategy carries weight in the face name: no numeric weight.
    expect(
      resolveFontStyle({ ...overrides, webWeightStrategy: "family" }, "sansSerif", "bold", { italic: true }),
    ).toEqual({ fontFamily: "Brand Italic" });
  });

  it("the newsreader preset is one stack with numeric weights and a real italic via fontStyle", () => {
    const preset = { serifPreset: "newsreader" as const };
    expect(resolveFontStyle({}, "serif", "semibold", preset)).toEqual({
      fontFamily: newsreaderFamilies.web,
      fontWeight: "600",
    });
    expect(newsreaderFamilies.web.startsWith("\"Newsreader\"")).toBe(true);
    expect(newsreaderFamilies.web).toContain("Georgia");
    expect(resolveFontStyle({}, "serif", "regular", { ...preset, italic: true })).toEqual({
      fontFamily: newsreaderFamilies.web,
      fontWeight: "400",
      fontStyle: "italic",
    });
  });

  it("the inter sans preset is one Inter stack with numeric weights", () => {
    expect(resolveFontStyle({}, "sansSerif", "semibold", { sansPreset: "inter" })).toEqual({
      fontFamily: interFamilies.web,
      fontWeight: "600",
    });
    expect(interFamilies.web.startsWith("\"Inter\"")).toBe(true);
    expect(interFamilies.web).toContain("system-ui");
    expect(resolveFontStyle({}, "sansSerif", "regular", { sansPreset: "inter", italic: true })).toEqual({
      fontFamily: interFamilies.web,
      fontWeight: "400",
      fontStyle: "italic",
    });
  });

  it("a setFonts sansSerif override beats the inter sans preset", () => {
    const overrides = { families: { sansSerif: { regular: "Brand" } } };
    expect(resolveFontStyle(overrides, "sansSerif", "medium", { sansPreset: "inter" })).toEqual({
      fontFamily: "Brand",
      fontWeight: "500",
    });
  });

  it.each<[SansPreset, string]>([
    ["allo-friendly", "Allo Friendly"],
    ["allo-round", "Allo Round"],
    ["geist", "Geist"],
    ["inter", "Inter"],
  ])("the %s sans preset is one %s stack with numeric weights", (sansPreset, family) => {
    const web = sansPresetFamilies[sansPreset].web;
    expect(web.startsWith(`"${family}", system-ui,`)).toBe(true);
    expect(resolveFontStyle({}, "sansSerif", "light", { sansPreset })).toEqual({ fontFamily: web, fontWeight: "400" });
    expect(resolveFontStyle({}, "sansSerif", "medium", { sansPreset })).toEqual({ fontFamily: web, fontWeight: "500" });
    expect(resolveFontStyle({}, "sansSerif", "bold", { sansPreset })).toEqual({ fontFamily: web, fontWeight: "700" });
    expect(resolveFontStyle({}, "sansSerif", "regular", { sansPreset, italic: true })).toEqual({
      fontFamily: web,
      fontWeight: "400",
      fontStyle: "italic",
    });
    // Serif never follows the sans preset.
    expect(resolveFontStyle({}, "serif", "regular", { sansPreset }).fontFamily).not.toContain(family);
  });

  it.each<[SansPreset]>([["allo"], ["allo-friendly"], ["allo-round"], ["geist"]])(
    "a setFonts sansSerif override beats the %s sans preset",
    (sansPreset) => {
      const overrides = { families: { sansSerif: { regular: "Brand" } } };
      expect(resolveFontStyle(overrides, "sansSerif", "semibold", { sansPreset })).toEqual({
        fontFamily: "Brand",
        fontWeight: "600",
      });
    },
  );
});
