/**
 * Surface Lab candidates.
 *
 * Each candidate is one surface ramp for one scheme. The Lab pushes the picked
 * pair into the theme store with `setColors`, so every package component
 * resolves against it while the screen is mounted (same contract as
 * `ThemedShowcaseScreen`).
 *
 * Values were generated in OKLCH (dark: hue 286 at chroma 0.004, or hue 264 at
 * chroma 0.012 for Slate; light: hue 286 at chroma 0.003) and emitted as hex.
 * "Current" is the zinc ramp the package ships (`packages/ui/src/constants/
 * colors.ts`); the Lab opens on it, and a test holds these hexes to the package
 * values. Deep, Lifted, Slate and Canvas are alternate presets for forks that
 * want more separation between tiers.
 *
 * Text tokens are not part of a candidate: they stay as the package defines
 * them, and `__tests__/surfaceLabCandidates.test.ts` holds every candidate to
 * the contrast floors in `packages/ui/src/constants/__tests__/colors.test.ts`.
 */

import type { ThemeColors } from "@mrmeg/expo-ui/constants";

export type SurfaceScheme = "light" | "dark";

/** The surface tokens a candidate sets, in ladder order (lowest tier first). */
export interface SurfaceRamp {
  surfaceSunken: string;
  background: string;
  card: string;
  popover: string;
  /** Also applied to `secondary`. */
  muted: string;
  /** Also applied to `input`. */
  border: string;
  borderStrong: string;
}

export type SurfaceTier = keyof SurfaceRamp;

export interface SurfaceCandidate {
  id: string;
  /** Segment label in the selector. */
  label: string;
  /** Full name shown under the selector. */
  name: string;
  summary: string;
  ramp: SurfaceRamp;
}

export const SURFACE_TIERS: { token: SurfaceTier; role: string }[] = [
  { token: "surfaceSunken", role: "App chrome, below content" },
  { token: "background", role: "Screen content" },
  { token: "card", role: "Raised panels and collection items" },
  { token: "popover", role: "Menus, dialogs, sheets, toasts" },
  { token: "muted", role: "Chips, insets, switch tracks" },
  { token: "border", role: "Hairlines on background and card" },
  { token: "borderStrong", role: "Hairlines on filled surfaces" },
];

export const DARK_CANDIDATES: SurfaceCandidate[] = [
  {
    id: "current",
    label: "Current",
    name: "Dark current (zinc)",
    summary: "Zinc hexes picked by eye; card and popover share one tier.",
    ramp: {
      surfaceSunken: "#050506",
      background: "#09090B",
      card: "#18181B",
      popover: "#18181B",
      muted: "#27272A",
      border: "#27272A",
      borderStrong: "#3F3F46",
    },
  },
  {
    id: "deep",
    label: "D Deep",
    name: "Dark D \"deep\"",
    summary: "Near-black base, wide tier spacing; the edge highlight carries depth. OKLCH L .11 / .145 / .195 / .235 / .265.",
    ramp: {
      surfaceSunken: "#040405",
      background: "#0A0A0C",
      card: "#151517",
      popover: "#1E1E20",
      muted: "#252527",
      border: "#27272A",
      borderStrong: "#363639",
    },
  },
  {
    id: "lifted",
    label: "A Lifted",
    name: "Dark A \"lifted neutral\"",
    summary: "Base lifted to about #111 so shadows have room to render; even ΔL steps, neutral hue. L .15 / .18 / .215 / .25 / .275.",
    ramp: {
      surfaceSunken: "#0B0B0D",
      background: "#111113",
      card: "#19191B",
      popover: "#212123",
      muted: "#27272A",
      border: "#2B2B2D",
      borderStrong: "#3A3A3D",
    },
  },
  {
    id: "slate",
    label: "B Slate",
    name: "Dark B \"slate\"",
    summary: "Same lightness as Lifted with a cool slate tint (hue 264, chroma 0.012).",
    ramp: {
      surfaceSunken: "#090B10",
      background: "#0F1217",
      card: "#17191F",
      popover: "#1F2228",
      muted: "#25282E",
      border: "#282B31",
      borderStrong: "#373B41",
    },
  },
];

export const LIGHT_CANDIDATES: SurfaceCandidate[] = [
  {
    id: "current",
    label: "Current",
    name: "Light current (white on white)",
    summary: "Background and card are both white; cards separate by border and shadow only.",
    ramp: {
      surfaceSunken: "#FAFAFA",
      background: "#FFFFFF",
      card: "#FFFFFF",
      popover: "#FFFFFF",
      muted: "#F4F4F5",
      border: "#E4E4E7",
      borderStrong: "#D4D4D8",
    },
  },
  {
    id: "canvas",
    label: "C Canvas",
    name: "Light C \"canvas\"",
    summary: "Off-white canvas under white paper: cards lift without heavier shadows.",
    ramp: {
      surfaceSunken: "#F0F0F2",
      background: "#F9F9FB",
      card: "#FFFFFF",
      popover: "#FFFFFF",
      muted: "#F0F0F2",
      border: "#E4E4E6",
      borderStrong: "#D4D4D6",
    },
  },
];

// The Lab opens on the package defaults.
export const DEFAULT_DARK_CANDIDATE = "current";
export const DEFAULT_LIGHT_CANDIDATE = "current";

export function findCandidate(list: SurfaceCandidate[], id: string): SurfaceCandidate {
  return list.find((candidate) => candidate.id === id) ?? list[0];
}

/** Expands a ramp into the theme tokens `setColors` takes (`muted` also sets `secondary`, `border` also `input`). */
export function rampToColors(ramp: SurfaceRamp): Partial<ThemeColors> {
  return {
    surfaceSunken: ramp.surfaceSunken,
    background: ramp.background,
    card: ramp.card,
    popover: ramp.popover,
    muted: ramp.muted,
    secondary: ramp.muted,
    border: ramp.border,
    input: ramp.border,
    borderStrong: ramp.borderStrong,
  };
}

/** OKLab lightness (0 black to 1 white) of an `#RRGGBB` color (Björn Ottosson's sRGB to OKLab). */
export function oklabLightness(hex: string): number {
  const value = hex.replace(/^#/, "");
  const [r, g, b] = [0, 2, 4]
    .map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)));

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}
