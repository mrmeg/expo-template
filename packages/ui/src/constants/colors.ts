import { Platform } from "react-native";
import { navigationFonts } from "./fonts";

/**
 * Raw color palette - use semantic colors in components instead
 *
 * Zinc-inspired neutral scale for a minimal, professional feel.
 * Status colors aligned with Tailwind's default palette.
 */
const palette = {
  // Brand (accent)
  teal400: "#2dd4bf",
  teal500: "#14b8a6",
  teal600: "#0d9488",

  // Neutrals — zinc scale
  white: "#FFFFFF",
  gray50: "#FAFAFA",
  gray100: "#F4F4F5",
  gray200: "#E4E4E7",
  gray300: "#D4D4D8",
  gray400: "#A1A1AA",
  gray500: "#71717A",
  gray600: "#52525B",
  gray700: "#3F3F46",
  gray800: "#27272A",
  gray900: "#18181B",
  gray950: "#09090B",
  black: "#000000",

  // Dark mode surfaces — zinc-based
  // `dark950` sits below zinc-950 as the app-chrome tier; `dark350` is a
  // zinc-350 midpoint used for dim text that stays comfortably readable.
  dark950: "#050506",
  dark900: "#09090B",
  dark800: "#18181B",
  dark700: "#27272A",
  dark600: "#3F3F46",
  dark400: "#A1A1AA",
  dark350: "#B0B0B8",
  dark300: "#D4D4D8",
  dark100: "#F4F4F5",

  // Status
  green500: "#22C55E",
  green400: "#4ADE80",
  amber500: "#F59E0B",
  amber400: "#FBBF24",
  red500: "#EF4444",
  red400: "#F87171",
} as const;

/**
 * Semantic color interface - what colors mean in the UI
 */
export interface ThemeColors {
  // Core surfaces
  // Elevation reads as layered tiers, not shadows:
  // `surfaceSunken` (app chrome) < `background` (content) < `card`/`popover`
  // (raised panels) < `muted` (chips, insets).
  surfaceSunken: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;

  // Text colors (semantic aliases for clarity)
  text: string;
  textDim: string;

  // Interactive elements
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;

  // Accent (brand highlight — teal)
  accent: string;
  accentForeground: string;

  // Status
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;

  // Utility
  border: string;
  // Hairline for elements sitting on a filled surface (chips on `muted`,
  // raised panels) — one visible step above the fill, where `border` would
  // disappear into it.
  borderStrong: string;
  input: string;
  ring: string;
  overlay: string;
}

export interface Theme {
  colors: ThemeColors;
  dark: boolean;
  fonts: typeof navigationFonts;

  // React Navigation compatibility (maps to ThemeColors)
  navigation: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
}

export interface Colors {
  light: Theme;
  dark: Theme;
}

const lightTheme: Theme = {
  dark: false,
  fonts: navigationFonts,
  colors: {
    surfaceSunken: palette.gray50,
    background: palette.white,
    foreground: palette.gray950,
    card: palette.white,
    cardForeground: palette.gray950,
    popover: palette.white,
    popoverForeground: palette.gray950,

    text: palette.gray950,
    textDim: palette.gray600,

    primary: palette.gray900,
    primaryForeground: palette.gray50,
    secondary: palette.gray100,
    secondaryForeground: palette.gray900,
    muted: palette.gray100,
    mutedForeground: palette.gray600,

    accent: palette.teal500,
    accentForeground: palette.white,

    destructive: palette.red500,
    destructiveForeground: palette.white,
    success: palette.green500,
    warning: palette.amber500,

    border: palette.gray200,
    borderStrong: palette.gray300,
    input: palette.gray200,
    ring: palette.gray400,
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  navigation: {
    primary: palette.gray900,
    background: palette.white,
    card: palette.gray50,
    text: palette.gray950,
    border: palette.gray200,
    notification: palette.teal500,
  },
};

const darkTheme: Theme = {
  dark: true,
  fonts: navigationFonts,
  colors: {
    surfaceSunken: palette.dark950,
    background: palette.dark900,
    foreground: palette.dark100,
    card: palette.dark800,
    cardForeground: palette.dark100,
    popover: palette.dark800,
    popoverForeground: palette.dark100,

    text: palette.dark100,
    textDim: palette.dark350,

    primary: palette.gray50,
    primaryForeground: palette.gray900,
    secondary: palette.gray800,
    secondaryForeground: palette.gray50,
    muted: palette.dark700,
    mutedForeground: palette.dark350,

    accent: palette.teal400,
    accentForeground: palette.gray900,

    destructive: palette.red400,
    destructiveForeground: palette.white,
    success: palette.green400,
    warning: palette.amber400,

    border: palette.dark700,
    borderStrong: palette.dark600,
    input: palette.dark700,
    ring: palette.dark400,
    overlay: "rgba(0, 0, 0, 0.7)",
  },
  navigation: {
    primary: palette.gray50,
    background: palette.dark900,
    card: palette.dark800,
    text: palette.dark100,
    border: palette.dark700,
    notification: palette.teal400,
  },
};

/**
 * Raw hex/rgba theme colors, always literal strings on every platform. Use
 * these for sinks that cannot take CSS `var()` — e.g. `<meta name="theme-color">`,
 * color parsing/math — and for generating the CSS variable definitions below.
 */
export const rawThemeColors: { light: ThemeColors; dark: ThemeColors } = {
  light: lightTheme.colors,
  dark: darkTheme.colors,
};

const themeColorTokens = Object.keys(lightTheme.colors) as (keyof ThemeColors)[];

// `surfaceSunken` → `--c-surface-sunken`
function cssVarName(token: keyof ThemeColors): string {
  return `--c-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

// Reverse lookup: "var(--c-surface-sunken)" → "surfaceSunken"
const varToToken = new Map<string, keyof ThemeColors>(
  themeColorTokens.map((token) => [`var(${cssVarName(token)})`, token])
);

/**
 * Resolves a theme color value to a literal color string. On web, theme
 * colors are `var(--c-*)` references; this maps one back to the given
 * scheme's raw hex/rgba. Literal inputs (including app override colors)
 * pass through unchanged.
 */
export function resolveRawColor(color: string, scheme: "light" | "dark"): string {
  const token = varToToken.get(color);
  return token ? rawThemeColors[scheme][token] : color;
}

// "R, G, B" from "#RRGGBB", "#RGB", or "rgb(a)(R, G, B[, A])" (alpha dropped).
function toRgbTriplet(value: string): string | null {
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
  let hex = value.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
}

/**
 * CSS custom-property definitions for every semantic theme color, for
 * embedding in a web app's `+html.tsx` global `<style>`. Each token gets
 * `--c-<kebab-token>` (the color value) and `--c-<kebab-token>-rgb` (a
 * comma-separated RGB triplet, alpha stripped — `withAlpha` builds
 * `rgba(var(--c-x-rgb), a)` from it).
 *
 * Light values are defined on `:root`; dark values apply under
 * `html[data-theme="dark"]`, with a `prefers-color-scheme` fallback for the
 * paint before any theme script stamps `data-theme`.
 *
 * Apps that override brand colors can pass those overrides so the emitted
 * CSS matches their theme.
 */
export function getThemeCssVariables(overrides?: {
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
}): string {
  const declarations = (scheme: "light" | "dark"): string =>
    themeColorTokens
      .map((token) => {
        const value = overrides?.[scheme]?.[token] ?? rawThemeColors[scheme][token];
        const name = cssVarName(token);
        const rgb = toRgbTriplet(value);
        return `${name}: ${value};${rgb ? ` ${name}-rgb: ${rgb};` : ""}`;
      })
      .join("\n      ");

  return `
    :root {
      ${declarations("light")}
    }

    @media (prefers-color-scheme: dark) {
      html:not([data-theme]) {
        ${declarations("dark")}
      }
    }

    html[data-theme="dark"] {
      ${declarations("dark")}
    }
  `;
}

// On web, semantic theme colors resolve to CSS custom properties so the
// build-time exported HTML is theme-agnostic: the first frame paints in the
// visitor's scheme purely from CSS, before any JS runs. Native keeps literal
// values (no CSS engine). The `navigation` maps stay literal on both
// platforms: @react-navigation internals color-parse their theme values.
const webVarColors = Object.fromEntries(
  themeColorTokens.map((token) => [token, `var(${cssVarName(token)})`])
) as unknown as ThemeColors;

export const colors: Colors =
  Platform.OS === "web"
    ? {
      light: { ...lightTheme, colors: { ...webVarColors } },
      dark: { ...darkTheme, colors: { ...webVarColors } },
    }
    : {
      light: lightTheme,
      dark: darkTheme,
    };

// Export palette for rare one-off cases
export { palette };
