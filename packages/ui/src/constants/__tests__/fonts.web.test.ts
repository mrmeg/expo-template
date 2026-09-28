/**
 * Web resolves weight numerically on one multi-weight family (the package's
 * "numeric" strategy). Italic therefore rides on `fontStyle` — Google Fonts
 * serves the real 400 italic for Inter and Newsreader from the stylesheets
 * `useResources` injects, and the browser synthesizes the other weights.
 */
import "../../components/__tests__/forceWebPlatform";

import { resolveFontStyle, newsreaderFamilies } from "../fonts";

describe("resolveFontStyle (web)", () => {
  it("keeps today's defaults: Inter + numeric weight, Georgia stack for serif", () => {
    expect(resolveFontStyle({}, "sansSerif", "semibold")).toEqual({
      fontFamily: expect.stringContaining("\"Inter\""),
      fontWeight: "600",
    });
    expect(resolveFontStyle({}, "serif", "regular")).toEqual({
      fontFamily: expect.stringContaining("Georgia"),
      fontWeight: "400",
    });
  });

  it("italic adds fontStyle and keeps the numeric weight", () => {
    expect(resolveFontStyle({}, "sansSerif", "medium", { italic: true })).toEqual({
      fontFamily: expect.stringContaining("\"Inter\""),
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
});
