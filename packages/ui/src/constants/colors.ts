import { Platform } from "react-native";
import { navigationFonts } from "./fonts";

/**
 * Raw color palette - use semantic colors in components instead
 *
 * The default themes use the `neutral*` scale (the Refined look). The `gray*`
 * and `dark*` zinc entries stay exported, unchanged, for apps that import them
 * and for `classicLook` (`state/looks.ts`). Status colors follow Tailwind's
 * default palette.
 */
const palette = {
  // Brand (accent)
  teal400: "#2dd4bf",
  teal500: "#14b8a6",
  teal600: "#0d9488",
  // Link text: teal600 is too light on white, teal700 clears 4.5:1; teal300
  // does the same on the dark surfaces.
  teal700: "#0F766E",
  teal300: "#5EEAD4",

  // Neutrals — Tailwind neutral scale (the default themes)
  neutral50: "#FAFAFA",
  neutral100: "#F5F5F5",
  neutral200: "#E5E5E5",
  neutral300: "#D4D4D4",
  neutral400: "#A3A3A3",
  // Light `ring`.
  neutralRing: "#A1A1A1",
  // Dark dim text: the darkest grey that keeps 6:1 on `muted` (neutral400 is
  // 5.999:1 there).
  neutralDim: "#A4A4A4",
  neutral500: "#737373",
  neutral600: "#525252",
  neutral700: "#404040",
  neutral750: "#333333",
  neutral800: "#262626",
  neutral900: "#171717",
  neutral950: "#0A0A0A",

  // Neutrals — zinc scale (Classic look)
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
  // Light `warning` under more contrast: amber500 is too light for text on
  // white, amber700 clears 4.5:1.
  amber700: "#B45309",
  red500: "#EF4444",
  red400: "#F87171",
  green700: "#15803D",
  red600: "#DC2626",
} as const;

/**
 * Extra color tokens an app declares for itself, so it stops keeping a side
 * palette. Empty here; an app augments it once and the keys become part of
 * `ThemeColors` everywhere — `setColors`, `ThemeColorScope`,
 * `useTheme().theme.colors`, `getThemeCssVariables`:
 *
 * ```ts
 * declare module "@mrmeg/expo-ui/constants" {
 *   interface ThemeColorExtensions {
 *     brandGold: string;
 *   }
 * }
 * useThemeStore.getState().setColors({
 *   light: { brandGold: "#c9a227" },
 *   dark: { brandGold: "#ffe066" },
 * });
 * ```
 *
 * The package ships no value for an extension key: provide it in both schemes
 * or the token is `undefined` at runtime in the scheme that lacks it. On web
 * the built-in tokens are `var(--c-*)` references and extension values are
 * literals per scheme, so with any override `theme.colors` is a new object
 * when the scheme changes (the identity caveat every override already has).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation target; apps add members
export interface ThemeColorExtensions {}

/**
 * Semantic color interface - what colors mean in the UI
 */
export interface ThemeColors extends ThemeColorExtensions {
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
  // Link text (Button `link`, inline links). Separate from `accent` because
  // the accent fill is too light to read as text on white.
  link: string;

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

/**
 * The package's own tokens: `ThemeColors` minus whatever an app added through
 * `ThemeColorExtensions`. The default palettes, the CSS-variable table and
 * `resolveRawColor` are typed on this, because the package has no value for an
 * extension key.
 */
export type ThemeColorTokens = Omit<ThemeColors, keyof ThemeColorExtensions>;

type BaseTheme = Omit<Theme, "colors"> & { colors: ThemeColorTokens };

const lightTheme: BaseTheme = {
  dark: false,
  fonts: navigationFonts,
  colors: {
    surfaceSunken: palette.neutral50,
    background: palette.white,
    foreground: palette.neutral950,
    card: palette.white,
    cardForeground: palette.neutral950,
    popover: palette.white,
    popoverForeground: palette.neutral950,

    text: palette.neutral950,
    textDim: palette.neutral600,

    primary: palette.neutral900,
    primaryForeground: palette.neutral50,
    secondary: palette.neutral100,
    secondaryForeground: palette.neutral900,
    muted: palette.neutral100,
    mutedForeground: palette.neutral600,

    accent: palette.teal500,
    accentForeground: palette.white,
    link: palette.teal700,

    destructive: palette.red600,
    destructiveForeground: palette.white,
    success: palette.green700,
    warning: palette.amber500,

    border: palette.neutral200,
    borderStrong: palette.neutral300,
    input: palette.neutral200,
    ring: palette.neutralRing,
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  navigation: {
    primary: palette.neutral900,
    background: palette.white,
    card: palette.neutral50,
    text: palette.neutral950,
    border: palette.neutral200,
    notification: palette.teal500,
  },
};

const darkTheme: BaseTheme = {
  dark: true,
  fonts: navigationFonts,
  colors: {
    surfaceSunken: palette.neutral950,
    background: palette.neutral950,
    foreground: palette.neutral50,
    card: palette.neutral900,
    cardForeground: palette.neutral50,
    popover: palette.neutral900,
    popoverForeground: palette.neutral50,

    text: palette.neutral50,
    textDim: palette.neutralDim,

    primary: palette.neutral200,
    primaryForeground: palette.neutral900,
    secondary: palette.neutral800,
    secondaryForeground: palette.neutral50,
    muted: palette.neutral800,
    mutedForeground: palette.neutralDim,

    accent: palette.teal400,
    accentForeground: palette.neutral900,
    link: palette.teal300,

    destructive: palette.red400,
    destructiveForeground: palette.white,
    success: palette.green400,
    warning: palette.amber400,

    border: palette.neutral800,
    borderStrong: palette.neutral700,
    input: palette.neutral750,
    ring: palette.neutral500,
    overlay: "rgba(0, 0, 0, 0.7)",
  },
  navigation: {
    primary: palette.neutral200,
    background: palette.neutral950,
    card: palette.neutral900,
    text: palette.neutral50,
    border: palette.neutral800,
    notification: palette.teal400,
  },
};

/**
 * Raw hex/rgba theme colors, always literal strings on every platform. Use
 * these for sinks that cannot take CSS `var()` — e.g. `<meta name="theme-color">`,
 * color parsing/math — and for generating the CSS variable definitions below.
 */
export const rawThemeColors: { light: ThemeColorTokens; dark: ThemeColorTokens } = {
  light: lightTheme.colors,
  dark: darkTheme.colors,
};

/** The contrast level a theme resolves to: the OS or user asked for more, or not. */
export type ResolvedContrast = "standard" | "more";

/**
 * The tokens "more" contrast changes, per scheme; every other token inherits
 * the scheme's normal value. Light: `accent` (white on teal700 is 5.5:1) and
 * `warning` darken to clear 4.5:1 on white. `ring` moves to the far end of the
 * scale in both schemes (neutral900 light, neutral300 dark) so the default soft
 * focus halo (3px at 50%) clears 3:1 as drawn: 3.4:1 and 3.9:1. Dark:
 * `destructiveForeground` flips to near-black so it clears 4.5:1 on `red400`.
 * `accentForeground` stays white in light.
 *
 * Tokens an app overrides itself (`setColors`, `ThemeColorScope`, a look)
 * keep the app's value: the app owns those.
 */
export const contrastColorOverrides: { light: Partial<ThemeColorTokens>; dark: Partial<ThemeColorTokens> } = {
  light: {
    accent: palette.teal700,
    warning: palette.amber700,
    ring: palette.neutral900,
  },
  dark: {
    destructiveForeground: palette.neutral900,
    ring: palette.neutral300,
  },
};

const themeColorTokens = Object.keys(lightTheme.colors) as (keyof ThemeColorTokens)[];

/**
 * Raw hex/rgba theme colors under "more" contrast: `rawThemeColors` with
 * `contrastColorOverrides` merged in. Literal strings on every platform, like
 * `rawThemeColors`.
 */
export const rawMoreContrastColors: { light: ThemeColorTokens; dark: ThemeColorTokens } = {
  light: { ...lightTheme.colors, ...contrastColorOverrides.light },
  dark: { ...darkTheme.colors, ...contrastColorOverrides.dark },
};

// `surfaceSunken` → `--c-surface-sunken`
function cssVarName(token: string): string {
  return `--c-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

const themeColorTokenSet = new Set<string>(themeColorTokens);

// Reverse lookup: "var(--c-surface-sunken)" → "surfaceSunken"
const varToToken = new Map<string, keyof ThemeColorTokens>(
  themeColorTokens.map((token) => [`var(${cssVarName(token)})`, token])
);

/**
 * Resolves a theme color value to a literal color string. On web, theme
 * colors are `var(--c-*)` references; this maps one back to the given
 * scheme's (and contrast level's, "standard" by default) raw hex/rgba. Literal
 * inputs (including app override colors) pass through unchanged.
 */
export function resolveRawColor(
  color: string,
  scheme: "light" | "dark",
  contrast: ResolvedContrast = "standard",
): string {
  const token = varToToken.get(color);
  if (!token) return color;
  return (contrast === "more" ? rawMoreContrastColors : rawThemeColors)[scheme][token];
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
 * "More" contrast (`contrastColorOverrides`) follows, after those blocks, in
 * four selectors per scheme: the stamped pair (`data-theme` + `data-contrast`),
 * each stamped attribute with the other's OS media fallback, and both
 * fallbacks. Each names its scheme explicitly because `html[data-theme="dark"]`
 * and `html[data-contrast="more"]` have equal specificity, so a bare
 * `html[data-contrast="more"]` block would leak light values into dark. A
 * contrast token the caller's `overrides` set for that scheme is left out
 * (the app's value wins, as on native), and a scheme with no tokens left emits
 * no block.
 *
 * Apps that override brand colors can pass those overrides so the emitted
 * CSS matches their theme. Extension tokens (`ThemeColorExtensions`) present
 * in the overrides get a variable too, per scheme that names them; the
 * package has no default to fall back to for those.
 */
export function getThemeCssVariables(overrides?: {
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
}): string {
  const extensionTokens = [
    ...Object.keys(overrides?.light ?? {}),
    ...Object.keys(overrides?.dark ?? {}),
  ].filter((token, index, all) => !themeColorTokenSet.has(token) && all.indexOf(token) === index);

  const declaration = (token: string, value: string): string => {
    const name = cssVarName(token);
    const rgb = toRgbTriplet(value);
    return `${name}: ${value};${rgb ? ` ${name}-rgb: ${rgb};` : ""}`;
  };

  const declarations = (scheme: "light" | "dark"): string =>
    [
      ...themeColorTokens.map((token) =>
        declaration(token, overrides?.[scheme]?.[token] ?? rawThemeColors[scheme][token]),
      ),
      ...extensionTokens.flatMap((token) => {
        const value = (overrides?.[scheme] as Record<string, string | undefined> | undefined)?.[token];
        return typeof value === "string" ? [declaration(token, value)] : [];
      }),
    ].join("\n      ");

  // Contrast blocks go last so they beat the base blocks at equal specificity.
  const contrastDeclarations = (scheme: "light" | "dark"): string =>
    (Object.keys(contrastColorOverrides[scheme]) as (keyof ThemeColorTokens)[])
      .filter((token) => overrides?.[scheme]?.[token] === undefined)
      .map((token) => declaration(token, contrastColorOverrides[scheme][token] as string))
      .join("\n        ");

  const contrastBlocks = (scheme: "light" | "dark"): string => {
    const body = contrastDeclarations(scheme);
    if (!body) return "";
    return `
    html[data-theme="${scheme}"][data-contrast="more"] {
        ${body}
    }

    @media (prefers-color-scheme: ${scheme}) {
      html:not([data-theme])[data-contrast="more"] {
        ${body}
      }
    }

    @media (prefers-contrast: more) {
      html[data-theme="${scheme}"]:not([data-contrast]) {
        ${body}
      }
    }

    @media (prefers-color-scheme: ${scheme}) and (prefers-contrast: more) {
      html:not([data-theme]):not([data-contrast]) {
        ${body}
      }
    }
`;
  };

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
${contrastBlocks("light")}${contrastBlocks("dark")}  `;
}

// On web, semantic theme colors resolve to CSS custom properties so the
// build-time exported HTML is theme-agnostic: the first frame paints in the
// visitor's scheme purely from CSS, before any JS runs. Native keeps literal
// values (no CSS engine). The `navigation` maps stay literal on both
// platforms: @react-navigation internals color-parse their theme values.
const webVarColors = Object.fromEntries(
  themeColorTokens.map((token) => [token, `var(${cssVarName(token)})`])
) as unknown as ThemeColors;

// Web: both schemes hold the same `var(--c-*)` references, so they share ONE
// `colors` object. A scheme switch then keeps `theme.colors` identical, so
// anything memoized on it keeps its result; the CSS variables do the
// re-theming. `colors.light` and `colors.dark` stay distinct objects:
// `dark`, `navigation`, and `fonts` differ per scheme.
// The base themes carry the package tokens only; extension keys (typed on
// `ThemeColors` once an app augments it) arrive through `setColors`.
export const colors: Colors =
  Platform.OS === "web"
    ? {
      light: { ...lightTheme, colors: webVarColors },
      dark: { ...darkTheme, colors: webVarColors },
    }
    : {
      light: lightTheme as Theme,
      dark: darkTheme as Theme,
    };

// Export palette for rare one-off cases
export { palette };
