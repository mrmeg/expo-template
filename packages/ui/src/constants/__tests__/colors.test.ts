/**
 * colors constants tests
 *
 * Locks in the readability floors and surface-tier ordering of the semantic
 * palette:
 *
 * - Dim text (`textDim`/`mutedForeground`) must stay far above the ~4.5:1
 *   meta-text contrast common in "moody" dark themes. These floors are the
 *   durable form of that requirement — dimming the tokens back down fails here.
 * - `borderStrong` must be a *visible* step away from the fills it borders
 *   (`muted`/`secondary`), guarding the old regression where `border` and
 *   `muted` were the same hex and hairlines vanished.
 * - Surface tiers must stay ordered by luminance so chrome reads as sunken
 *   beneath content.
 *
 * The WCAG math is reimplemented locally (~15 lines) rather than exported from
 * `hooks/useTheme.ts`, which keeps those helpers private.
 */

import { colors, palette } from "../colors";
import type { ThemeColors } from "../colors";

/** WCAG relative luminance for an `#RRGGBB` string. */
function luminance(hex: string): number {
  const value = hex.replace(/^#/, "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const sRGB = channels.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return sRGB[0] * 0.2126 + sRGB[1] * 0.7152 + sRGB[2] * 0.0722;
}

/** WCAG contrast ratio (1–21) between two `#RRGGBB` strings. */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const schemes: ["light", "dark"] = ["light", "dark"];

describe("contrast helpers", () => {
  it("matches known WCAG reference ratios", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // Ordering is symmetric.
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    // Tailwind zinc-500 on white — the well-known ~4.8:1 value.
    expect(contrastRatio("#71717A", "#FFFFFF")).toBeCloseTo(4.83, 1);
  });
});

describe.each(schemes)("%s theme readability", (scheme) => {
  const theme: ThemeColors = colors[scheme].colors;
  const dimTokens: (keyof ThemeColors)[] = ["textDim", "mutedForeground"];

  it.each(dimTokens)("keeps %s at >= 7:1 on background, card, and popover", (token) => {
    for (const surface of ["background", "card", "popover"] as const) {
      expect(contrastRatio(theme[token], theme[surface])).toBeGreaterThanOrEqual(7);
    }
  });

  it.each(dimTokens)("keeps %s at >= 6:1 on muted and secondary fills", (token) => {
    for (const surface of ["muted", "secondary"] as const) {
      expect(contrastRatio(theme[token], theme[surface])).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(["text", "foreground"] as const)(
    "keeps %s at >= 12:1 on background and card",
    (token) => {
      for (const surface of ["background", "card"] as const) {
        expect(contrastRatio(theme[token], theme[surface])).toBeGreaterThanOrEqual(12);
      }
    }
  );

  it("keeps dim text visibly dimmer than primary text", () => {
    expect(theme.textDim).not.toBe(theme.text);
    expect(contrastRatio(theme.textDim, theme.background)).toBeLessThan(
      contrastRatio(theme.text, theme.background)
    );
  });

  it("gives borderStrong a visible step away from the fills it borders", () => {
    expect(theme.borderStrong).not.toBe(theme.muted);
    expect(theme.borderStrong).not.toBe(theme.secondary);
  });
});

describe("surface tiers", () => {
  it("orders dark chrome below content below raised panels", () => {
    const dark = colors.dark.colors;
    expect(luminance(dark.surfaceSunken)).toBeLessThan(luminance(dark.background));
    expect(luminance(dark.background)).toBeLessThan(luminance(dark.card));
  });

  it("sinks light chrome below the content surface", () => {
    // Light `card` and `background` are both white, so only the chrome step is
    // strictly ordered here.
    const light = colors.light.colors;
    expect(luminance(light.surfaceSunken)).toBeLessThan(luminance(light.background));
  });
});

describe("semantic token values", () => {
  it("maps the new surface and border tokens to palette entries", () => {
    expect(colors.dark.colors.surfaceSunken).toBe(palette.dark950);
    expect(colors.dark.colors.borderStrong).toBe(palette.dark600);
    expect(colors.light.colors.surfaceSunken).toBe(palette.gray50);
    expect(colors.light.colors.borderStrong).toBe(palette.gray300);
  });

  it("uses the raised dim-text values in both schemes", () => {
    expect(colors.dark.colors.textDim).toBe(palette.dark350);
    expect(colors.dark.colors.mutedForeground).toBe(palette.dark350);
    expect(colors.light.colors.textDim).toBe(palette.gray600);
    expect(colors.light.colors.mutedForeground).toBe(palette.gray600);
  });
});
