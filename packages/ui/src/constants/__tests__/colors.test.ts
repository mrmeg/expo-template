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

import {
  colors,
  contrastColorOverrides,
  getThemeCssVariables,
  palette,
  rawMoreContrastColors,
  rawThemeColors,
  resolveRawColor,
} from "../colors";
import { moreContrastColors } from "../contrastThemes";
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

/** `fg` at `alpha` over `bg`, both `#RRGGBB`, as `#RRGGBB`. */
function blend(fg: string, bg: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(fg, i) * alpha + channel(bg, i) * (1 - alpha)).toString(16).padStart(2, "0"))
    .join("")}`;
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

  it("keeps link at >= 4.5:1 on background, card, and popover", () => {
    for (const surface of ["background", "card", "popover"] as const) {
      expect(contrastRatio(theme.link, theme[surface])).toBeGreaterThanOrEqual(4.5);
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

describe("labels on the accent", () => {
  // SegmentedControl picks between these two; `accentForeground` is not the
  // readable one in light (white on the teal is 2.4:1).
  it("keeps a readable candidate on the accent in both schemes", () => {
    const light = colors.light.colors;
    const dark = colors.dark.colors;
    expect(contrastRatio(light.foreground, light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.background, dark.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("surface tiers", () => {
  it("orders dark chrome at or below content, and content below raised panels", () => {
    // Refined dark has no separate chrome tier: `surfaceSunken` and
    // `background` are both #0A0A0A, and the raised panels lift off them.
    const dark = colors.dark.colors;
    expect(luminance(dark.surfaceSunken)).toBeLessThanOrEqual(luminance(dark.background));
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
    expect(colors.dark.colors.surfaceSunken).toBe(palette.neutral950);
    expect(colors.dark.colors.borderStrong).toBe(palette.neutral700);
    expect(colors.light.colors.surfaceSunken).toBe(palette.neutral50);
    expect(colors.light.colors.borderStrong).toBe(palette.neutral300);
  });

  it("uses the raised dim-text values in both schemes", () => {
    expect(colors.dark.colors.textDim).toBe(palette.neutralDim);
    expect(colors.dark.colors.mutedForeground).toBe(palette.neutralDim);
    expect(colors.light.colors.textDim).toBe(palette.neutral600);
    expect(colors.light.colors.mutedForeground).toBe(palette.neutral600);
  });

  it("ships the Refined neutral scale, not zinc", () => {
    expect(colors.light.colors.primary).toBe("#171717");
    expect(colors.light.colors.border).toBe("#E5E5E5");
    expect(colors.dark.colors.background).toBe("#0A0A0A");
    expect(colors.dark.colors.card).toBe("#171717");
    expect(colors.dark.colors.primary).toBe("#E5E5E5");
  });

  it("keeps the zinc palette entries exported for Classic and existing imports", () => {
    expect(palette.gray900).toBe("#18181B");
    expect(palette.dark350).toBe("#B0B0B8");
  });

  it("keeps the navigation maps on the same neutrals", () => {
    expect(colors.light.navigation.primary).toBe(colors.light.colors.primary);
    expect(colors.light.navigation.border).toBe(colors.light.colors.border);
    expect(colors.dark.navigation.background).toBe(colors.dark.colors.background);
    expect(colors.dark.navigation.card).toBe(colors.dark.colors.card);
    expect(colors.dark.navigation.border).toBe(colors.dark.colors.border);
  });
});

describe("more contrast", () => {
  it("overrides exactly the documented tokens, from palette entries", () => {
    expect(contrastColorOverrides).toEqual({
      light: { accent: palette.teal700, warning: palette.amber700, ring: palette.neutral900 },
      dark: { destructiveForeground: palette.neutral900, ring: palette.neutral300 },
    });
    expect(palette.amber700).toBe("#B45309");
    expect(palette.teal700).toBe("#0F766E");
    expect(palette.neutral300).toBe("#D4D4D4");
    expect(palette.neutral900).toBe("#171717");
  });

  it("builds rawMoreContrastColors as rawThemeColors plus the overrides", () => {
    for (const scheme of schemes) {
      expect(rawMoreContrastColors[scheme]).toEqual({
        ...rawThemeColors[scheme],
        ...contrastColorOverrides[scheme],
      });
    }
    // Everything not overridden is untouched.
    expect(rawMoreContrastColors.light.link).toBe(rawThemeColors.light.link);
    expect(rawMoreContrastColors.light.accentForeground).toBe(palette.white);
    expect(rawMoreContrastColors.dark.accent).toBe(rawThemeColors.dark.accent);
  });

  it("resolves var() references against the contrast level, standard by default", () => {
    expect(resolveRawColor("var(--c-accent)", "light")).toBe(palette.teal500);
    expect(resolveRawColor("var(--c-accent)", "light", "standard")).toBe(palette.teal500);
    expect(resolveRawColor("var(--c-accent)", "light", "more")).toBe(palette.teal700);
    expect(resolveRawColor("var(--c-warning)", "light", "more")).toBe(palette.amber700);
    expect(resolveRawColor("var(--c-destructive-foreground)", "dark", "more")).toBe(palette.neutral900);
    expect(resolveRawColor("var(--c-destructive-foreground)", "dark")).toBe(palette.white);
    // Un-overridden tokens and literals are unaffected.
    expect(resolveRawColor("var(--c-background)", "dark", "more")).toBe(palette.neutral950);
    expect(resolveRawColor("#123456", "light", "more")).toBe("#123456");
  });

  it("clears the WCAG floors the overrides exist for", () => {
    const light = rawMoreContrastColors.light;
    const dark = rawMoreContrastColors.dark;
    expect(contrastRatio(light.accentForeground, light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.warning, palette.white)).toBeGreaterThanOrEqual(4.5);
    // The default (soft) focus ring is a 3px halo at 50%: judge it as drawn.
    expect(contrastRatio(blend(light.ring, light.background, 0.5), light.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blend(dark.ring, dark.background, 0.5), dark.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(dark.destructiveForeground, dark.destructive)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.neutral900, palette.red400)).toBeGreaterThanOrEqual(4.5);
  });

  it("merges the overrides into the native base themes without touching the standard ones", () => {
    expect(moreContrastColors.light.colors.accent).toBe(palette.teal700);
    expect(moreContrastColors.light.colors.warning).toBe(palette.amber700);
    expect(moreContrastColors.light.colors.ring).toBe(palette.neutral900);
    expect(moreContrastColors.dark.colors.destructiveForeground).toBe(palette.neutral900);
    expect(moreContrastColors.dark.colors.ring).toBe(palette.neutral300);
    expect(moreContrastColors.light.colors.background).toBe(colors.light.colors.background);
    expect(moreContrastColors.light.dark).toBe(false);
    expect(moreContrastColors.dark.dark).toBe(true);
    expect(colors.light.colors.accent).toBe(palette.teal500);
    expect(colors.dark.colors.destructiveForeground).toBe(palette.white);
  });
});

describe("getThemeCssVariables more contrast", () => {
  const css = getThemeCssVariables();
  const compact = (value: string) => value.replace(/\s+/g, " ");

  /** Declarations of the rule `selector` (inside `@media <media> { … }` when given), or null. */
  function ruleBody(selector: string, media?: string): string | null {
    const flat = compact(css);
    const head = media ? `@media ${media} { ${selector} {` : `${selector} {`;
    const start = flat.indexOf(head);
    if (start === -1) return null;
    return flat.slice(start, flat.indexOf("}", start));
  }

  const combos = (scheme: "light" | "dark") => [
    ruleBody(`html[data-theme="${scheme}"][data-contrast="more"]`),
    ruleBody(`html:not([data-theme])[data-contrast="more"]`, `(prefers-color-scheme: ${scheme})`),
    ruleBody(`html[data-theme="${scheme}"]:not([data-contrast])`, "(prefers-contrast: more)"),
    ruleBody(
      "html:not([data-theme]):not([data-contrast])",
      `(prefers-color-scheme: ${scheme}) and (prefers-contrast: more)`
    ),
  ];

  it("emits all eight selector and media combinations", () => {
    for (const scheme of schemes) {
      for (const body of combos(scheme)) expect(body).not.toBeNull();
    }
  });

  it("puts the light overrides only under light selectors and the dark ones only under dark", () => {
    for (const body of combos("light")) {
      expect(body).toContain(`--c-accent: ${palette.teal700};`);
      expect(body).toContain(`--c-warning: ${palette.amber700};`);
      expect(body).toContain(`--c-ring: ${palette.neutral900};`);
      expect(body).not.toContain("--c-destructive-foreground");
    }
    for (const body of combos("dark")) {
      expect(body).toContain(`--c-destructive-foreground: ${palette.neutral900};`);
      expect(body).toContain(`--c-ring: ${palette.neutral300};`);
      expect(body).not.toContain("--c-accent");
      expect(body).not.toContain("--c-warning");
    }
    // No bare contrast selector that would leak light values into dark.
    expect(compact(css)).not.toMatch(/(^|[^\]\w])html\[data-contrast="more"\] \{/);
  });

  it("overrides the rgb triplet too, so withAlpha(ring) follows", () => {
    expect(combos("light")[0]).toContain("--c-ring-rgb: 23, 23, 23;");
    expect(combos("dark")[0]).toContain("--c-ring-rgb: 212, 212, 212;");
    expect(combos("light")[0]).toContain("--c-accent-rgb: 15, 118, 110;");
    expect(combos("dark")[0]).toContain("--c-destructive-foreground-rgb: 23, 23, 23;");
  });

  it("emits the contrast blocks after the base blocks", () => {
    const flat = compact(css);
    expect(flat.indexOf(`html[data-theme="dark"][data-contrast="more"]`)).toBeGreaterThan(
      flat.indexOf(`html[data-theme="dark"] {`)
    );
  });

  it("lets an app override win over a contrast token", () => {
    const overridden = compact(getThemeCssVariables({ light: { accent: "#ff0000" } }));
    const start = overridden.indexOf(`html[data-theme="light"][data-contrast="more"]`);
    const body = overridden.slice(start, overridden.indexOf("}", start));
    expect(body).not.toContain("--c-accent");
    expect(body).toContain("--c-warning");
    // The base block still carries the app's accent.
    expect(overridden).toContain("--c-accent: #ff0000;");
    // The overrides for a scheme never affect the other scheme's blocks.
    expect(overridden).toContain(`--c-destructive-foreground: ${palette.neutral900};`);
  });

  it("emits no block for a scheme whose contrast tokens are all overridden", () => {
    const flat = compact(
      getThemeCssVariables({ dark: { destructiveForeground: "#000000", ring: "#888888" } })
    );
    expect(flat).not.toContain(`html[data-theme="dark"][data-contrast="more"]`);
    expect(flat).not.toContain("(prefers-color-scheme: dark) and (prefers-contrast: more)");
    expect(flat).toContain(`html[data-theme="light"][data-contrast="more"]`);
  });
});
