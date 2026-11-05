/**
 * Surface Lab candidate data.
 *
 * The Lab pushes a candidate ramp through `setColors` and leaves text tokens as
 * the package defines them, so each candidate has to clear the same contrast
 * floors as `packages/ui/src/constants/__tests__/colors.test.ts` (text >= 12:1
 * and dim text >= 7:1 on background, card, and popover; dim text >= 6:1 on
 * muted and secondary). The WCAG math is reimplemented here for the same reason
 * it is there: `useTheme` keeps its helpers private.
 */

import { rawThemeColors } from "@mrmeg/expo-ui/constants";

import {
  DARK_CANDIDATES,
  DEFAULT_DARK_CANDIDATE,
  DEFAULT_LIGHT_CANDIDATE,
  LIGHT_CANDIDATES,
  SURFACE_TIERS,
  findCandidate,
  oklabLightness,
  rampToColors,
  type SurfaceCandidate,
  type SurfaceScheme,
} from "../surfaceLabCandidates";
import {
  DEFAULT_SHADOW_TREATMENT,
  SHADOW_TREATMENTS,
  findTreatment,
  previousShadow,
} from "../surfaceLabShadows";

function luminance(hex: string): number {
  const value = hex.replace(/^#/, "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const SCHEME_CANDIDATES: [SurfaceScheme, SurfaceCandidate[]][] = [
  ["dark", DARK_CANDIDATES],
  ["light", LIGHT_CANDIDATES],
];

describe("oklabLightness", () => {
  it("anchors black at 0 and white at 1", () => {
    expect(oklabLightness("#000000")).toBeCloseTo(0, 3);
    expect(oklabLightness("#FFFFFF")).toBeCloseTo(1, 3);
  });
});

describe("candidate ids", () => {
  it.each(SCHEME_CANDIDATES)("%s ids and labels are unique", (_scheme, list) => {
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    expect(new Set(list.map((c) => c.label)).size).toBe(list.length);
  });

  it("defaults to the current candidates in both schemes", () => {
    expect(findCandidate(DARK_CANDIDATES, DEFAULT_DARK_CANDIDATE).id).toBe("current");
    expect(findCandidate(LIGHT_CANDIDATES, DEFAULT_LIGHT_CANDIDATE).id).toBe("current");
  });

  it("opens on exactly the package default ramps", () => {
    const dark = rampToColors(findCandidate(DARK_CANDIDATES, DEFAULT_DARK_CANDIDATE).ramp);
    const light = rampToColors(findCandidate(LIGHT_CANDIDATES, DEFAULT_LIGHT_CANDIDATE).ramp);

    for (const token of Object.keys(dark) as (keyof typeof dark)[]) {
      expect(dark[token]).toBe(rawThemeColors.dark[token]);
    }
    for (const token of Object.keys(light) as (keyof typeof light)[]) {
      expect(light[token]).toBe(rawThemeColors.light[token]);
    }
  });

  it("gives the dark alternates their own dim text and leaves the package ramp on its own", () => {
    for (const candidate of DARK_CANDIDATES) {
      const colors = rampToColors(candidate.ramp);
      if (candidate.id === "current") {
        expect(colors.textDim).toBeUndefined();
        expect(colors.mutedForeground).toBeUndefined();
      } else {
        expect(candidate.ramp.textDim).toMatch(/^#[0-9A-F]{6}$/);
        expect(colors.textDim).toBe(candidate.ramp.textDim);
        expect(colors.mutedForeground).toBe(candidate.ramp.textDim);
      }
    }
  });

  it("falls back to the first candidate for an unknown id", () => {
    expect(findCandidate(DARK_CANDIDATES, "nope")).toBe(DARK_CANDIDATES[0]);
  });
});

describe.each(SCHEME_CANDIDATES)("%s candidates", (scheme, list) => {
  const text = rawThemeColors[scheme];

  describe.each(list.map((candidate) => [candidate.name, candidate] as const))("%s", (_name, candidate) => {
    it("uses #RRGGBB for every tier", () => {
      for (const { token } of SURFACE_TIERS) {
        expect(candidate.ramp[token]).toMatch(/^#[0-9A-F]{6}$/);
      }
    });

    it("keeps text >= 12:1 on background, card, and popover", () => {
      for (const surface of ["background", "card", "popover"] as const) {
        expect(contrastRatio(text.text, candidate.ramp[surface])).toBeGreaterThanOrEqual(12);
        expect(contrastRatio(text.foreground, candidate.ramp[surface])).toBeGreaterThanOrEqual(12);
      }
    });

    // A candidate may carry its own dim text (the dark alternates do); the
    // Lab applies it to `textDim` and `mutedForeground` through `setColors`.
    const applied = rampToColors(candidate.ramp);
    const textDim = applied.textDim ?? text.textDim;
    const mutedForeground = applied.mutedForeground ?? text.mutedForeground;

    it("keeps dim text >= 7:1 on background, card, and popover", () => {
      for (const surface of ["background", "card", "popover"] as const) {
        expect(contrastRatio(textDim, candidate.ramp[surface])).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(mutedForeground, candidate.ramp[surface])).toBeGreaterThanOrEqual(7);
      }
    });

    it("keeps dim text >= 6:1 on muted and secondary", () => {
      for (const surface of [applied.muted, applied.secondary] as string[]) {
        expect(contrastRatio(textDim, surface)).toBeGreaterThanOrEqual(6);
        expect(contrastRatio(mutedForeground, surface)).toBeGreaterThanOrEqual(6);
      }
    });

    it("gives borderStrong a step away from muted", () => {
      expect(candidate.ramp.borderStrong).not.toBe(candidate.ramp.muted);
    });
  });
});

describe("dark tier ordering", () => {
  it.each(DARK_CANDIDATES.map((candidate) => [candidate.name, candidate] as const))(
    "%s sinks chrome to or below content, and content below card",
    (_name, candidate) => {
      const { surfaceSunken, background, card } = candidate.ramp;
      // Refined dark has one base for chrome and content; the alternates keep a step.
      expect(oklabLightness(surfaceSunken)).toBeLessThanOrEqual(oklabLightness(background));
      if (candidate.id !== "current") {
        expect(oklabLightness(surfaceSunken)).toBeLessThan(oklabLightness(background));
      }
      expect(oklabLightness(background)).toBeLessThan(oklabLightness(card));
    },
  );

  it.each(DARK_CANDIDATES.filter((candidate) => candidate.id !== "current").map((c) => [c.name, c] as const))(
    "%s lifts popover above card",
    (_name, candidate) => {
      expect(oklabLightness(candidate.ramp.popover)).toBeGreaterThan(oklabLightness(candidate.ramp.card));
    },
  );

  it("matches the OKLCH lightness the deep ramp was generated from", () => {
    const { ramp } = findCandidate(DARK_CANDIDATES, "deep");
    const targets = [
      [ramp.surfaceSunken, 0.11],
      [ramp.background, 0.145],
      [ramp.card, 0.195],
      [ramp.popover, 0.235],
      [ramp.muted, 0.265],
    ] as const;

    for (const [hex, target] of targets) {
      expect(Math.abs(oklabLightness(hex) - target)).toBeLessThan(0.01);
    }
  });
});

describe("light canvas", () => {
  it("puts white paper above an off-white canvas", () => {
    const { ramp } = findCandidate(LIGHT_CANDIDATES, "canvas");
    expect(oklabLightness(ramp.background)).toBeLessThan(oklabLightness(ramp.card));
    expect(oklabLightness(ramp.surfaceSunken)).toBeLessThan(oklabLightness(ramp.background));
  });
});

describe("rampToColors", () => {
  it("also applies muted to secondary and border to input", () => {
    const colors = rampToColors(findCandidate(DARK_CANDIDATES, "deep").ramp);
    expect(colors.secondary).toBe(colors.muted);
    expect(colors.input).toBe(colors.border);
  });

  it("lets a ramp set input apart from border (the Refined dark input)", () => {
    const colors = rampToColors(findCandidate(DARK_CANDIDATES, "current").ramp);
    expect(colors.input).toBe("#333333");
    expect(colors.border).toBe("#262626");
  });
});

describe("shadow treatments", () => {
  it("offers the frozen previous presets as the baseline and the package shadows as the default", () => {
    expect(SHADOW_TREATMENTS.map((treatment) => treatment.id)).toEqual(["previous", "package"]);
    expect(DEFAULT_SHADOW_TREATMENT).toBe("package");
    expect(findTreatment("package").label).toBe("Package");
    expect(findTreatment("nope").id).toBe("previous");
  });

  it("freezes the old presets, with dark alpha tripled and no highlight", () => {
    expect(previousShadow("light", "subtle")).toBe(
      "0px 1px 3px rgba(0, 0, 0, 0.04), 0px 2px 8px rgba(0, 0, 0, 0.03)",
    );
    expect(previousShadow("dark", "subtle")).toBe(
      "0px 1px 3px rgba(0, 0, 0, 0.12), 0px 2px 8px rgba(0, 0, 0, 0.09)",
    );
    expect(previousShadow("dark", "elevated")).not.toContain("inset");
  });
});
