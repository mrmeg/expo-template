/**
 * Surface Lab shadow treatments.
 *
 * `package` is the package's own `getShadowStyle`, so the specimen always shows
 * what ships. `subtle` follows the `elevation` treatment, whose default is
 * "hairline": one faint 1px shadow in light and none in dark, the 1px border
 * drawing the edge. `soft` and `elevated` stay dual-layer, with the 1px inset
 * top highlight in dark. The dual-layer `subtle` of earlier releases is what
 * `elevation: "layered"` (or `classicLook`) gives.
 *
 * `previous` is a frozen copy of the presets the package used before the
 * edge-lit change, kept as a baseline: black dual-layer shadows with the dark
 * alpha tripled (`0.04 * 3`) and no highlight, which is invisible on a
 * near-black base. Only the presets the Lab specimen draws are kept (`Card`
 * uses `subtle`; `Popover`, `Dialog`, `DropdownMenu` and `Select` use `soft`;
 * `Notification` uses `elevated`).
 */

import type { SurfaceScheme } from "./surfaceLabCandidates";

export type ShadowTreatment = "previous" | "package";
export type ShadowPreset = "subtle" | "soft" | "elevated";

export const SHADOW_TREATMENTS: { id: ShadowTreatment; label: string; summary: string }[] = [
  {
    id: "previous",
    label: "Previous",
    summary: "The pre-edge-lit getShadowStyle: dual-layer black, alpha tripled in dark where it barely shows.",
  },
  {
    id: "package",
    label: "Package",
    summary: "The package default. Cards use the hairline subtle shadow (1px in light, none in dark); menus and toasts stay dual-layer, with a 1px inset top highlight in dark. elevation: \"layered\" restores the dual-layer card shadow.",
  },
];

export const DEFAULT_SHADOW_TREATMENT: ShadowTreatment = "package";

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
