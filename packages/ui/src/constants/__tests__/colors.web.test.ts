/**
 * Web theme colors.
 *
 * On web every semantic color is a `var(--c-*)` reference, identical in both
 * schemes, so the two schemes share one `colors` object: a scheme switch keeps
 * `theme.colors` identical and anything memoized on it keeps its result. The
 * per-scheme fields around it (`dark`, `navigation`, `fonts`) stay distinct.
 */
// Must be the first import: `colors` resolves its platform at module load.
import "../../components/__tests__/forceWebPlatform";
import { colors, rawThemeColors } from "../colors";

describe("web colors", () => {
  it("shares one colors object between the light and dark schemes", () => {
    expect(colors.light.colors).toBe(colors.dark.colors);
    expect(colors.light.colors.background).toBe("var(--c-background)");
    expect(colors.light.colors.surfaceSunken).toBe("var(--c-surface-sunken)");
  });

  it("keeps the per-scheme fields distinct", () => {
    expect(colors.light).not.toBe(colors.dark);
    expect(colors.light.dark).toBe(false);
    expect(colors.dark.dark).toBe(true);
    expect(colors.light.navigation.background).toBe(rawThemeColors.light.background);
    expect(colors.dark.navigation.background).toBe(rawThemeColors.dark.background);
  });

  it("maps every semantic token to its CSS variable", () => {
    for (const token of Object.keys(rawThemeColors.light)) {
      const kebab = token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(colors.dark.colors[token as keyof typeof rawThemeColors.light]).toBe(`var(--c-${kebab})`);
    }
  });
});
