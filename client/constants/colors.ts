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
  dark900: "#09090B",
  dark800: "#18181B",
  dark700: "#27272A",
  dark600: "#3F3F46",
  dark400: "#A1A1AA",
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
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;

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
    background: palette.white,
    foreground: palette.gray950,
    card: palette.gray50,
    cardForeground: palette.gray950,

    text: palette.gray950,
    textDim: palette.gray500,

    primary: palette.gray900,
    primaryForeground: palette.gray50,
    secondary: palette.teal500,
    secondaryForeground: palette.white,
    muted: palette.gray100,
    mutedForeground: palette.gray500,

    accent: palette.teal500,
    accentForeground: palette.white,

    destructive: palette.red500,
    destructiveForeground: palette.white,
    success: palette.green500,
    warning: palette.amber500,

    border: palette.gray200,
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
    background: palette.dark900,
    foreground: palette.dark100,
    card: palette.dark800,
    cardForeground: palette.dark100,

    text: palette.dark100,
    textDim: palette.dark400,

    primary: palette.gray50,
    primaryForeground: palette.gray900,
    secondary: palette.teal400,
    secondaryForeground: palette.black,
    muted: palette.dark700,
    mutedForeground: palette.dark400,

    accent: palette.teal400,
    accentForeground: palette.gray900,

    destructive: palette.red400,
    destructiveForeground: palette.white,
    success: palette.green400,
    warning: palette.amber400,

    border: palette.dark700,
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

export const colors: Colors = {
  light: lightTheme,
  dark: darkTheme,
};

// Export palette for rare one-off cases
export { palette };
