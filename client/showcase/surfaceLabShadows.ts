/**
 * Surface Lab shadow treatments.
 *
 * `edge-lit` is the package's own `getShadowStyle` (prototyped here, picked, and
 * now the default): in dark a 1px inset top highlight plus deeper black layers
 * at real alpha, in light the same dual-layer shadow at about double the
 * original alpha. The Lab calls `getShadowStyle` for it, so the specimen always
 * shows what ships.
 *
 * `previous` is a frozen copy of the presets the package used before the
 * change, kept as a baseline: black dual-layer shadows, with the dark alpha tripled
 * (`0.04 * 3`), which is invisible on a near-black base. Only the presets the
 * Lab specimen draws are kept (`Card` uses `subtle`; `Popover`, `Dialog`,
 * `DropdownMenu` and `Select` use `soft`; `Notification` uses `elevated`).
 */

import type { SurfaceScheme } from "./surfaceLabCandidates";

export type ShadowTreatment = "previous" | "edge-lit";
export type ShadowPreset = "subtle" | "soft" | "elevated";

export const SHADOW_TREATMENTS: { id: ShadowTreatment; label: string; summary: string }[] = [
  {
    id: "previous",
    label: "Previous",
    summary: "The old getShadowStyle: dual-layer black, alpha tripled in dark where it barely shows.",
  },
  {
    id: "edge-lit",
    label: "Edge-lit",
    summary: "The package default. Dark: 1px inset top highlight plus a deeper black shadow. Light: the shadow at about double the old alpha.",
  },
];

export const DEFAULT_SHADOW_TREATMENT: ShadowTreatment = "edge-lit";

export function findTreatment(id: string) {
  return SHADOW_TREATMENTS.find((item) => item.id === id) ?? SHADOW_TREATMENTS[0];
}

const PREVIOUS: Record<SurfaceScheme, Record<ShadowPreset, string>> = {
  light: {
    subtle: "0px 1px 3px rgba(0, 0, 0, 0.04), 0px 2px 8px rgba(0, 0, 0, 0.03)",
    soft: "0px 4px 10px rgba(0, 0, 0, 0.05), 0px 8px 20px rgba(0, 0, 0, 0.03)",
    elevated: "0px 16px 48px rgba(0, 0, 0, 0.08), 0px 32px 96px rgba(0, 0, 0, 0.05)",
  },
  dark: {
    subtle: "0px 1px 3px rgba(0, 0, 0, 0.12), 0px 2px 8px rgba(0, 0, 0, 0.09)",
    soft: "0px 4px 10px rgba(0, 0, 0, 0.15), 0px 8px 20px rgba(0, 0, 0, 0.09)",
    elevated: "0px 16px 48px rgba(0, 0, 0, 0.24), 0px 32px 96px rgba(0, 0, 0, 0.15)",
  },
};

/** The `boxShadow` value of the frozen previous presets for one scheme and preset. */
export function previousShadow(scheme: SurfaceScheme, preset: ShadowPreset): string {
  return PREVIOUS[scheme][preset];
}
