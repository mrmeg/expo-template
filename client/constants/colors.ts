import { navigationFonts } from "./fonts";

/**
 * Raw color palette - use semantic colors in components instead
 */
const palette = {
  // Brand
  teal400: "#2dd4bf",
  teal500: "#14b8a6",
  teal600: "#0d9488",

  // Neutrals (light mode)
  white: "#FFFFFF",
  gray50: "#FAFAFA",
  gray100: "#F4F5F7",
  gray200: "#E9ECEF",
  gray500: "#6C757D",
  gray800: "#2C2C2C",
  black: "#000000",

  // Neutrals (dark mode)
  dark900: "#121212",
  dark800: "#1E1E1E",
  dark700: "#343A40",
  dark400: "#495057",
  dark100: "#E5E5E5",

  // Status
  green500: "#4CAF50",
  green400: "#66BB6A",
  amber500: "#F59E0B",
  amber400: "#FFA726",
  red500: "#FF5252",
  red400: "#EF5350",
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

  // Interactive elements
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;

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
    foreground: palette.gray800,
    card: palette.gray100,
    cardForeground: palette.gray800,

    primary: palette.teal400,
    primaryForeground: palette.white,
    secondary: palette.teal500,
    secondaryForeground: palette.white,
    muted: palette.gray200,
    mutedForeground: palette.gray500,

    destructive: palette.red500,
    destructiveForeground: palette.white,
    success: palette.green500,
    warning: palette.amber500,

    border: palette.gray200,
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  navigation: {
    primary: palette.teal400,
    background: palette.white,
    card: palette.gray100,
    text: palette.gray800,
    border: palette.gray200,
    notification: palette.teal400,
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

    primary: palette.teal400,
    primaryForeground: palette.black,
    secondary: palette.teal400,
    secondaryForeground: palette.black,
    muted: palette.dark700,
    mutedForeground: palette.dark400,

    destructive: palette.red400,
    destructiveForeground: palette.white,
    success: palette.green400,
    warning: palette.amber400,

    border: palette.dark700,
    overlay: "rgba(0, 0, 0, 0.7)",
  },
  navigation: {
    primary: palette.teal400,
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
