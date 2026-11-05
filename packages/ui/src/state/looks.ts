import type { FontOverrides, SansPreset, SerifPreset } from "../constants/fonts";
import {
  useThemeStore,
  type ColorOverrides,
  type ShapeOverrides,
  type TreatmentOverrides,
} from "./themeStore";

/**
 * A look: one named bundle of the theme store's override slots. The package's
 * built-in values are the Refined look; any other look is expressed as
 * overrides on top of them, so applying one is the same `setColors` /
 * `setFonts` / `setShape` / `setTreatments` an app would call by hand.
 *
 * `sans` / `serif` pick a font preset. The faces must already be loaded
 * (`useResources({ sans: "inter", sansFonts })` on native; web loads the
 * stylesheet on demand) — `applyLook` only switches which family resolves.
 */
export type Look = {
  id: string;
  name: string;
  description?: string;
  colors?: ColorOverrides;
  fonts?: FontOverrides;
  shape?: ShapeOverrides;
  treatments?: TreatmentOverrides;
  sans?: SansPreset;
  serif?: SerifPreset;
};

/** The package default since 0.35.0: Geist, neutral greys, teal as the dot and links. */
export const refinedLook: Look = {
  id: "refined",
  name: "Refined",
  description: "Geist, neutral greys, teal only as the selection dot and links, 8 / 14 radius.",
};

/**
 * The package default before 0.35.0: Inter, zinc neutrals, teal selection,
 * 10 / 14 radius, dual-layer shadows. Apply it at startup to keep an app on
 * the old look after upgrading (and load Inter: see `useResources`).
 */
export const classicLook: Look = {
  id: "classic",
  name: "Classic",
  description: "Inter, zinc neutrals with teal selection, 10 / 14 radius, dual-layer shadows.",
  sans: "inter",
  colors: {
    light: {
      surfaceSunken: "#FAFAFA",
      background: "#FFFFFF",
      foreground: "#09090B",
      card: "#FFFFFF",
      cardForeground: "#09090B",
      popover: "#FFFFFF",
      popoverForeground: "#09090B",
      text: "#09090B",
      textDim: "#52525B",
      primary: "#18181B",
      primaryForeground: "#FAFAFA",
      secondary: "#F4F4F5",
      secondaryForeground: "#18181B",
      muted: "#F4F4F5",
      mutedForeground: "#52525B",
      accent: "#14b8a6",
      accentForeground: "#FFFFFF",
      link: "#14b8a6",
      destructive: "#EF4444",
      destructiveForeground: "#FFFFFF",
      success: "#22C55E",
      warning: "#F59E0B",
      border: "#E4E4E7",
      borderStrong: "#D4D4D8",
      input: "#E4E4E7",
      ring: "#A1A1AA",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#050506",
      background: "#09090B",
      foreground: "#F4F4F5",
      card: "#18181B",
      cardForeground: "#F4F4F5",
      popover: "#18181B",
      popoverForeground: "#F4F4F5",
      text: "#F4F4F5",
      textDim: "#B0B0B8",
      primary: "#FAFAFA",
      primaryForeground: "#18181B",
      secondary: "#27272A",
      secondaryForeground: "#FAFAFA",
      muted: "#27272A",
      mutedForeground: "#B0B0B8",
      accent: "#2dd4bf",
      accentForeground: "#18181B",
      link: "#2dd4bf",
      destructive: "#F87171",
      destructiveForeground: "#FFFFFF",
      success: "#4ADE80",
      warning: "#FBBF24",
      border: "#27272A",
      borderStrong: "#3F3F46",
      input: "#27272A",
      ring: "#A1A1AA",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 10 },
    input: { borderRadius: 10 },
  },
  treatments: {
    segmentedSelection: "accent",
    switchTrack: "accent",
    eyebrow: "uppercase",
    focusRing: "offset",
    elevation: "layered",
  },
};

/**
 * Apply a look: replaces every override slot it covers (an omitted slot is
 * cleared back to the package default) and switches the font presets.
 * `applyLook(refinedLook)` returns to the package defaults. Pair it with
 * `getThemeCssVariables(look.colors)` in a web app's `+html.tsx` so the first
 * paint already matches.
 */
export function applyLook(look: Look): void {
  const store = useThemeStore.getState();
  store.setColors(look.colors ?? {});
  store.setFonts(look.fonts ?? {});
  store.setShape(look.shape ?? {});
  store.setTreatments(look.treatments ?? {});
  store.setSansPreset(look.sans ?? "geist");
  if (look.serif) store.setSerifPreset(look.serif);
}
