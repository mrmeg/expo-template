import { rawThemeColors, type ThemeColors } from "@mrmeg/expo-ui/constants";

import { DEMO_LOOKS } from "../looks";

type Scheme = "light" | "dark";
const SCHEMES: Scheme[] = ["light", "dark"];
const TOKENS = Object.keys(rawThemeColors.light) as (keyof typeof rawThemeColors.light)[];

/** Looks the package ships (Refined is its default, Classic its legacy look). */
const PACKAGE_LOOK_IDS = new Set(["refined", "classic"]);

/**
 * Known failures in the package's own `classicLook`, which this demo shows
 * unchanged: its light `link` is the brand teal #14b8a6, 2.49:1 on white. The
 * pre-0.35 look is kept as it shipped; Refined moved the link to teal-700.
 */
const KNOWN_LOW_CONTRAST = new Set(["classic:light:link"]);

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  throw new Error(`unparseable color: ${value}`);
}

/** `top` laid over an opaque `bottom`, as the screen composites a translucent fill. */
function over(top: string, bottom: string): Rgba {
  const [tr, tg, tb, ta] = parseColor(top);
  const [br, bg, bb] = parseColor(bottom);
  return [tr * ta + br * (1 - ta), tg * ta + bg * (1 - ta), tb * ta + bb * (1 - ta), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** The scheme's palette as the screen resolves it: package defaults under the look's overrides. */
function resolved(id: string, scheme: Scheme): ThemeColors {
  const look = DEMO_LOOKS.find((demo) => demo.look.id === id)!.look;
  return { ...rawThemeColors[scheme], ...look.colors?.[scheme] } as ThemeColors;
}

describe("demo looks", () => {
  it("lists Refined first, then Classic, Strand, Glass, Editorial", () => {
    expect(DEMO_LOOKS.map((demo) => demo.look.id)).toEqual(["refined", "classic", "strand", "glass", "editorial"]);
  });

  it.each(DEMO_LOOKS.filter((demo) => !PACKAGE_LOOK_IDS.has(demo.look.id)).map((demo) => demo.look))(
    "$id colors both schemes with every package token",
    (look) => {
      for (const scheme of SCHEMES) {
        expect(Object.keys(look.colors?.[scheme] ?? {}).sort()).toEqual([...TOKENS].sort());
      }
      expect(look.shape).toEqual(
        expect.objectContaining({
          button: expect.any(Object),
          input: expect.any(Object),
          card: expect.any(Object),
          badge: expect.any(Object),
          dialog: expect.any(Object),
        }),
      );
      expect(look.treatments).toBeDefined();
    },
  );

  describe.each(DEMO_LOOKS.map((demo) => demo.look.id))("%s contrast", (id) => {
    it.each(SCHEMES)("text, textDim and link read at 4.5:1 on background and card (%s)", (scheme) => {
      const colors = resolved(id, scheme);
      const surfaces = { background: parseColor(colors.background), card: over(colors.card, colors.background) };
      for (const [surface, bg] of Object.entries(surfaces)) {
        for (const token of ["text", "textDim", "link"] as const) {
          if (KNOWN_LOW_CONTRAST.has(`${id}:${scheme}:${token}`)) continue;
          const ratio = contrast(over(colors[token], colors.background), bg);
          // Name the failing pair in the message.
          expect({ id, scheme, token, surface, ok: ratio >= 4.5, ratio: Number(ratio.toFixed(2)) }).toEqual(
            expect.objectContaining({ ok: true }),
          );
        }
      }
    });
  });
});
