import { rawThemeColors } from "@mrmeg/expo-ui/constants";
import { classicLook, defaultTreatments } from "@mrmeg/expo-ui/state";

import {
  getDemoLook,
  lookButtonShadow,
  lookColorRows,
  lookFontRows,
  lookShapeRows,
  lookSnippet,
  lookStrip,
  lookTreatmentRows,
  neighbourLooks,
  resolveLookColors,
} from "../lookReference";
import { DEMO_LOOKS } from "../looks";

const demo = (id: string) => {
  const found = getDemoLook(id);
  if (!found) throw new Error(`no look ${id}`);
  return found;
};

describe("lookReference", () => {
  it("resolves Refined to the package palette, so its swatches are not blank", () => {
    expect(resolveLookColors(demo("refined").look)).toEqual(rawThemeColors);
    expect(lookStrip(demo("refined").look, "light")[0]).toBe(rawThemeColors.light.background);
  });

  it("resolves Classic to its overrides over the package palette", () => {
    const colors = resolveLookColors(classicLook);
    expect(colors.light.accent).toBe(classicLook.colors?.light?.accent);
    expect(colors.dark.card).toBe(classicLook.colors?.dark?.card);
    // A token Classic leaves alone keeps the package value.
    expect(colors.light.overlay).toBe(classicLook.colors?.light?.overlay ?? rawThemeColors.light.overlay);
  });

  it("lists every semantic token once, flagging the ones a look sets", () => {
    const rows = lookColorRows(demo("strand").look);
    expect(rows.map((row) => row.token)).toEqual(Object.keys(rawThemeColors.light));
    expect(rows.find((row) => row.token === "accent")).toMatchObject({ light: "#0a6aa6", dark: "#8fd3ff", changed: true });
    expect(lookColorRows(demo("refined").look).some((row) => row.changed)).toBe(false);
  });

  it("merges treatments over the package defaults", () => {
    const refined = lookTreatmentRows(demo("refined").look);
    expect(Object.fromEntries(refined.map((row) => [row.name, row.value]))).toEqual(defaultTreatments);
    expect(refined.some((row) => row.changed)).toBe(false);

    const classic = lookTreatmentRows(classicLook);
    expect(classic.find((row) => row.name === "elevation")).toMatchObject({ value: "layered", changed: true });
    // Classic sets `focusRing: "offset"`, which differs from the soft default.
    expect(classic.find((row) => row.name === "focusRing")?.changed).toBe(true);
  });

  it("merges radii over the package slot defaults", () => {
    const refined = Object.fromEntries(lookShapeRows(demo("refined").look).map((row) => [row.slot, row.radius]));
    expect(refined).toEqual({ button: 8, input: 8, card: 14, sheet: "platform", badge: 9999, dialog: 14 });

    const strand = Object.fromEntries(lookShapeRows(demo("strand").look).map((row) => [row.slot, row.radius]));
    expect(strand).toMatchObject({ button: 2, card: 2, sheet: 2 });
    expect(lookButtonShadow(demo("strand").look)).toBe(false);
    expect(lookButtonShadow(demo("refined").look)).toBe(true);
  });

  it("resolves a family for every font variant", () => {
    const rows = lookFontRows(demo("refined").look);
    expect(rows.map((row) => row.variant)).toEqual(["sansSerif", "serif", "mono"]);
    expect(rows.every((row) => row.family.length > 0)).toBe(true);
    // Editorial asks for the Newsreader serif preset.
    expect(lookFontRows(demo("editorial").look).find((row) => row.variant === "serif")?.family).toMatch(/Newsreader/);
  });

  it("generates an applyLook snippet from the package export for Refined and Classic", () => {
    expect(lookSnippet(demo("refined"))).toContain("applyLook(refinedLook)");
    const classic = lookSnippet(demo("classic"));
    expect(classic).toContain("import { applyLook, classicLook } from \"@mrmeg/expo-ui/state\"");
    expect(classic).toContain("applyLook(classicLook)");
    expect(classic).toContain("Inter");
  });

  it("generates the Look object to copy for template looks, plus the fonts they need", () => {
    const strand = lookSnippet(demo("strand"));
    expect(strand).toContain("applyLook(strandLook)");
    expect(strand).toContain("const strandLook: Look = {");
    expect(strand).toContain("accent: \"#0a6aa6\"");
    expect(strand).toContain("Archivo");
    expect(strand).toContain("fonts.googleapis.com");

    const editorial = lookSnippet(demo("editorial"));
    expect(editorial).toContain("serif: \"newsreader\"");
    expect(editorial).toContain("sans: \"inter\"");
    expect(editorial).toContain("Newsreader");
  });

  it("generates a snippet for every look, and the object parses back to the same colors", () => {
    for (const { look } of DEMO_LOOKS) {
      const snippet = lookSnippet(demo(look.id));
      expect(snippet).toContain("applyLook(");
      if (look.id !== "refined" && look.id !== "classic") {
        const literal = snippet.slice(snippet.indexOf("= {") + 2, snippet.indexOf("};") + 1);
        const parsed = new Function(`return (${literal});`)();
        expect(parsed.colors).toEqual(look.colors);
        expect(parsed.shape).toEqual(look.shape);
        expect(parsed.treatments).toEqual(look.treatments);
      }
    }
  });

  it("looks a look up by id and finds its neighbours, wrapping around", () => {
    expect(getDemoLook("glass")?.look.name).toBe("Glass");
    expect(getDemoLook("nope")).toBeUndefined();
    expect(getDemoLook(undefined)).toBeUndefined();
    expect(neighbourLooks("refined")?.previous.look.id).toBe(DEMO_LOOKS[DEMO_LOOKS.length - 1].look.id);
    expect(neighbourLooks("editorial")?.next.look.id).toBe("refined");
    expect(neighbourLooks("nope")).toBeUndefined();
  });
});
