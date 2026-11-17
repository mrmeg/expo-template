/**
 * `resolveFontStyle` is the one place every text component turns a variant,
 * weight and italic flag into `{ fontFamily, fontWeight?, fontStyle? }`. Native
 * platform here (jest-expo's default); the web strategy has its own file.
 *
 * Italic: a real italic face wins and emits no `fontStyle`; without one the
 * upright face gets `fontStyle: "italic"` and the OS synthesizes. The serif
 * preset (`"newsreader"`) supplies faces for the serif variant only, and an
 * app's `setFonts` serif override still beats it.
 */
import {
  defaultSansPreset,
  interFamilies,
  newsreaderFamilies,
  resolveFontStyle,
  sansPresetFamilies,
  type SansPreset,
} from "../fonts";

describe("resolveFontStyle (native)", () => {
  it("keeps today's defaults: Georgia serif, Allo Sharp files, no fontStyle", () => {
    expect(resolveFontStyle({}, "serif", "bold")).toEqual({ fontFamily: "Georgia" });
    expect(resolveFontStyle({}, "sansSerif", "semibold")).toEqual({ fontFamily: "AlloSharp_600SemiBold" });
    expect(resolveFontStyle({}, "sansSerif", "regular", {})).toEqual({ fontFamily: "AlloSharp_400Regular" });
  });

  it("synthesizes italic when no italic face exists", () => {
    expect(resolveFontStyle({}, "sansSerif", "regular", { italic: true })).toEqual({
      fontFamily: "AlloSharp_400Regular",
      fontStyle: "italic",
    });
    expect(resolveFontStyle({}, "serif", "regular", { italic: true })).toEqual({
      fontFamily: "Georgia",
      fontStyle: "italic",
    });
  });

  it("uses an app's italic face for its weight, falls back to the italic regular, and emits no fontStyle", () => {
    const overrides = {
      families: {
        sansSerif: {
          regular: "Brand_Regular",
          bold: "Brand_Bold",
          italic: { regular: "Brand_Italic", bold: "Brand_BoldItalic" },
        },
      },
    };
    expect(resolveFontStyle(overrides, "sansSerif", "bold", { italic: true })).toEqual({ fontFamily: "Brand_BoldItalic" });
    expect(resolveFontStyle(overrides, "sansSerif", "regular", { italic: true })).toEqual({ fontFamily: "Brand_Italic" });
    // Medium has no italic face: the italic regular stands in, like the weight fallback.
    expect(resolveFontStyle(overrides, "sansSerif", "medium", { italic: true })).toEqual({ fontFamily: "Brand_Italic" });
    // Upright text is untouched by the italic map.
    expect(resolveFontStyle(overrides, "sansSerif", "bold")).toEqual({ fontFamily: "Brand_Bold" });
  });

  it("an override group with no italic map synthesizes on its upright face", () => {
    const overrides = { families: { sansSerif: { regular: "Brand_Regular" } } };
    expect(resolveFontStyle(overrides, "sansSerif", "bold", { italic: true })).toEqual({
      fontFamily: "Brand_Regular",
      fontStyle: "italic",
    });
  });

  it("the newsreader preset supplies the serif faces: four weights and one italic", () => {
    const preset = { serifPreset: "newsreader" as const };
    expect(resolveFontStyle({}, "serif", "regular", preset)).toEqual({ fontFamily: "Newsreader_400Regular" });
    expect(resolveFontStyle({}, "serif", "light", preset)).toEqual({ fontFamily: "Newsreader_400Regular" });
    expect(resolveFontStyle({}, "serif", "medium", preset)).toEqual({ fontFamily: "Newsreader_500Medium" });
    expect(resolveFontStyle({}, "serif", "semibold", preset)).toEqual({ fontFamily: "Newsreader_600SemiBold" });
    expect(resolveFontStyle({}, "serif", "bold", preset)).toEqual({ fontFamily: "Newsreader_700Bold" });
    // One italic file is loaded, so every weight's italic is that face — a real italic, not a slant.
    expect(resolveFontStyle({}, "serif", "bold", { ...preset, italic: true })).toEqual({
      fontFamily: "Newsreader_400Regular_Italic",
    });
    expect(newsreaderFamilies.native).toEqual({
      light: "Newsreader_400Regular",
      regular: "Newsreader_400Regular",
      medium: "Newsreader_500Medium",
      semibold: "Newsreader_600SemiBold",
      bold: "Newsreader_700Bold",
    });
    expect(newsreaderFamilies.nativeItalic).toBe("Newsreader_400Regular_Italic");
  });

  it("leaves sansSerif and mono alone under the serif preset, and setFonts serif still wins", () => {
    const preset = { serifPreset: "newsreader" as const };
    expect(resolveFontStyle({}, "sansSerif", "regular", preset)).toEqual({ fontFamily: "AlloSharp_400Regular" });
    expect(resolveFontStyle({}, "mono", "regular", preset).fontFamily).not.toContain("Newsreader");

    const overrides = { families: { serif: { regular: "Brand_Serif", italic: { regular: "Brand_SerifItalic" } } } };
    expect(resolveFontStyle(overrides, "serif", "regular", preset)).toEqual({ fontFamily: "Brand_Serif" });
    expect(resolveFontStyle(overrides, "serif", "regular", { ...preset, italic: true })).toEqual({ fontFamily: "Brand_SerifItalic" });
  });

  it("the inter sans preset resolves to the four Inter static files", () => {
    const preset = { sansPreset: "inter" as const };
    expect(resolveFontStyle({}, "sansSerif", "light", preset)).toEqual({ fontFamily: "Inter_400Regular" });
    expect(resolveFontStyle({}, "sansSerif", "regular", preset)).toEqual({ fontFamily: "Inter_400Regular" });
    expect(resolveFontStyle({}, "sansSerif", "medium", preset)).toEqual({ fontFamily: "Inter_500Medium" });
    expect(resolveFontStyle({}, "sansSerif", "semibold", preset)).toEqual({ fontFamily: "Inter_600SemiBold" });
    expect(resolveFontStyle({}, "sansSerif", "bold", preset)).toEqual({ fontFamily: "Inter_700Bold" });
    expect(interFamilies.native.bold).toBe("Inter_700Bold");
    // The explicit default is the same as no preset.
    expect(defaultSansPreset).toBe("allo");
    expect(resolveFontStyle({}, "sansSerif", "bold", { sansPreset: "allo" })).toEqual({ fontFamily: "AlloSharp_700Bold" });
  });

  it("the inter sans preset leaves serif and mono alone, and setFonts sansSerif still wins", () => {
    const preset = { sansPreset: "inter" as const };
    expect(resolveFontStyle({}, "serif", "regular", preset)).toEqual({ fontFamily: "Georgia" });
    expect(resolveFontStyle({}, "mono", "regular", preset).fontFamily).not.toContain("Inter");

    const overrides = { families: { sansSerif: { regular: "Brand_Regular" } } };
    expect(resolveFontStyle(overrides, "sansSerif", "bold", preset)).toEqual({ fontFamily: "Brand_Regular" });
  });

  it.each<[SansPreset, string]>([
    ["allo-friendly", "AlloFriendly"],
    ["allo-round", "AlloRound"],
    ["geist", "Geist"],
    ["inter", "Inter"],
  ])("the %s sans preset resolves to its four %s static files", (sansPreset, prefix) => {
    const preset = { sansPreset };
    expect(resolveFontStyle({}, "sansSerif", "light", preset)).toEqual({ fontFamily: `${prefix}_400Regular` });
    expect(resolveFontStyle({}, "sansSerif", "regular", preset)).toEqual({ fontFamily: `${prefix}_400Regular` });
    expect(resolveFontStyle({}, "sansSerif", "medium", preset)).toEqual({ fontFamily: `${prefix}_500Medium` });
    expect(resolveFontStyle({}, "sansSerif", "semibold", preset)).toEqual({ fontFamily: `${prefix}_600SemiBold` });
    expect(resolveFontStyle({}, "sansSerif", "bold", preset)).toEqual({ fontFamily: `${prefix}_700Bold` });
    // No preset italic file on native: the slant is synthesized on the upright face.
    expect(resolveFontStyle({}, "sansSerif", "bold", { ...preset, italic: true })).toEqual({
      fontFamily: `${prefix}_700Bold`,
      fontStyle: "italic",
    });
    // Serif and mono never follow the sans preset.
    expect(resolveFontStyle({}, "serif", "regular", preset)).toEqual({ fontFamily: "Georgia" });
    expect(resolveFontStyle({}, "mono", "regular", preset).fontFamily).not.toContain(prefix);
  });

  it("names every preset's native faces in sansPresetFamilies, the default included", () => {
    expect(sansPresetFamilies.allo.native).toEqual({
      light: "AlloSharp_400Regular",
      regular: "AlloSharp_400Regular",
      medium: "AlloSharp_500Medium",
      semibold: "AlloSharp_600SemiBold",
      bold: "AlloSharp_700Bold",
    });
    expect(sansPresetFamilies["allo-friendly"].native.semibold).toBe("AlloFriendly_600SemiBold");
    expect(sansPresetFamilies["allo-round"].native.medium).toBe("AlloRound_500Medium");
    expect(sansPresetFamilies.geist.native.bold).toBe("Geist_700Bold");
    expect(interFamilies).toBe(sansPresetFamilies.inter);
  });

  it.each<[SansPreset]>([["allo"], ["allo-friendly"], ["allo-round"], ["geist"], ["inter"]])(
    "a setFonts sansSerif override beats the %s sans preset",
    (sansPreset) => {
      const overrides = { families: { sansSerif: { regular: "Brand_Regular", semibold: "Brand_SemiBold" } } };
      expect(resolveFontStyle(overrides, "sansSerif", "semibold", { sansPreset })).toEqual({ fontFamily: "Brand_SemiBold" });
      expect(resolveFontStyle(overrides, "sansSerif", "bold", { sansPreset })).toEqual({ fontFamily: "Brand_Regular" });
    },
  );
});
