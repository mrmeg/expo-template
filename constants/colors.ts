import { navigationFonts } from "./fonts";

export interface Colors {
  // Base color palette - DaisyUI-inspired structure
  base: {
    // Background layers
    "base-100": string;  // Main background
    "base-200": string;  // Slightly darker background
    "base-300": string;  // Darker background
    "base-content": string;  // Main text color

    // Neutral variations for UI elements
    neutral: string;  // Neutral color
    "neutral-focus": string;  // Darker neutral for hover/focus
    "neutral-content": string;  // Text on neutral

    // Core theme colors - teal brand
    primary: string;  // Primary brand color (teal)
    "primary-focus": string;  // Darker primary for hover/focus
    "primary-content": string;  // Text on primary

    secondary: string;  // Secondary color
    "secondary-focus": string;  // Darker secondary for hover/focus
    "secondary-content": string;  // Text on secondary

    accent: string;  // Accent color
    "accent-focus": string;  // Darker accent for hover/focus
    "accent-content": string;  // Text on accent

    // Semantic colors
    info: string;  // Information
    "info-content": string;

    success: string;  // Success states
    "success-content": string;

    warning: string;  // Warning states
    "warning-content": string;

    error: string;  // Error states
    "error-content": string;

    // Utility colors
    white: string;       // Pure white
    black: string;       // Pure black
    overlay: string;     // Semi-transparent overlay for modals

    // Additional utility colors
    inactive: string;    // Inactive/disabled state color

    // Legacy color scales (for gradual migration)
    gray: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    blue: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    teal: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
  };
  dark: Theme;
  light: Theme;
}

export interface Theme {
  colors: {
    // React Navigation required properties (mapped to DaisyUI equivalents)
    primary: string;     // Required by React Navigation
    background: string;  // Required by React Navigation → maps to base-100
    card: string;        // Required by React Navigation → maps to base-200
    text: string;        // Required by React Navigation → maps to base-content
    border: string;      // Required by React Navigation → maps to base-300
    notification: string; // Required by React Navigation → maps to info

    // Text color utilities (used by Button for contrast calculations)
    textLight: string;   // Light text (white) for dark backgrounds
    textDark: string;    // Dark text for light backgrounds

    // DaisyUI theme variables
    "primary-focus": string;
    "primary-content": string;

    secondary: string;
    "secondary-focus": string;
    "secondary-content": string;

    accent: string;
    "accent-focus": string;
    "accent-content": string;

    neutral: string;
    "neutral-focus": string;
    "neutral-content": string;

    "base-100": string;  // Background
    "base-200": string;  // Slightly darker background
    "base-300": string;  // Even darker background
    "base-content": string;  // Main text

    info: string;
    "info-content": string;

    success: string;
    "success-content": string;

    warning: string;
    "warning-content": string;

    error: string;
    "error-content": string;

    // Utility colors - theme-aware
    white: string;       // Pure white for overlays, icons
    black: string;       // Pure black for shadows, overlays
    overlay: string;     // Semi-transparent overlay for modals

    // React Native Reusables color tokens (mapped to DaisyUI)
    input: string;       // Input border color → maps to base-300
    "primary-foreground": string;  // Text on primary → maps to primary-content
    destructive: string; // Destructive/error color → maps to error
    ring: string;        // Focus ring color → primary with opacity
  };
  dark: boolean;
  fonts: typeof navigationFonts;
  mode: "light" | "dark";
}

// Teal-based color palette
const tealPalette = {
  50: "#f0fdfa",
  100: "#ccfbf1",
  200: "#99f6e4",
  300: "#5eead4",
  400: "#2dd4bf",
  500: "#14b8a6", // Primary brand color
  600: "#0d9488",
  700: "#0f766e",
  800: "#115e59",
  900: "#134e4a",
  950: "#042f2e",
};

const grayPalette = {
  50: "#F8F9FA",
  100: "#F1F3F5",
  200: "#E9ECEF",
  300: "#DEE2E6",
  400: "#CED4DA",
  500: "#ADB5BD",
  600: "#6C757D",
  700: "#495057",
  800: "#343A40",
  900: "#212529",
};

const bluePalette = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB",
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
  950: "#172554",
};

const defaultColors: Colors["base"] = {
  // Background layers
  "base-100": "#FFFFFF",           // Main background (white)
  "base-200": "#F4F5F7",           // Slightly darker (warm paper)
  "base-300": "#E9ECEF",           // Darker (gray-200)
  "base-content": "#2C2C2C",       // Main text (charcoal)

  // Neutral colors
  neutral: grayPalette[600],       // Standard gray
  "neutral-focus": grayPalette[700], // Darker gray for hover
  "neutral-content": "#FFFFFF",    // Text on neutral

  // Primary (teal brand)
  primary: tealPalette[500],       // Primary teal
  "primary-focus": tealPalette[600], // Darker teal for hover
  "primary-content": "#FFFFFF",    // Text on primary

  // Secondary (teal accent)
  secondary: tealPalette[500],     // Secondary teal
  "secondary-focus": tealPalette[600], // Darker teal for hover
  "secondary-content": "#FFFFFF",  // Text on secondary

  // Accent (lighter teal)
  accent: tealPalette[300],        // Accent teal
  "accent-focus": tealPalette[400], // Darker accent for hover
  "accent-content": "#000000",     // Text on accent

  // Semantic colors
  info: bluePalette[400],          // Info blue
  "info-content": bluePalette[900], // Text on info

  success: "#4CAF50",              // Success green
  "success-content": "#FFFFFF",    // Text on success

  warning: "#F59E0B",              // Warning amber
  "warning-content": "#FFFFFF",    // Text on warning

  error: "#FF5252",                // Error red
  "error-content": "#FFFFFF",      // Text on error

  // Utility colors
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0, 0, 0, 0.5)",

  // Additional utility colors
  inactive: grayPalette[500],  // Inactive/disabled state

  // Legacy color scales (preserved for backward compatibility)
  gray: grayPalette,
  blue: bluePalette,
  teal: tealPalette,
};

const lightTheme: Colors["light"] = {
  dark: false,
  fonts: navigationFonts,
  mode: "light",
  colors: {
    // React Navigation required properties (mapped to DaisyUI equivalents)
    primary: defaultColors.primary,
    background: defaultColors["base-100"],
    card: defaultColors["base-200"],
    text: defaultColors["base-content"],
    border: defaultColors["base-300"],
    notification: defaultColors.info,

    // Text color utilities (used by Button for contrast calculations)
    textLight: defaultColors.white,
    textDark: defaultColors["base-content"],

    // DaisyUI theme variables
    "primary-focus": defaultColors["primary-focus"],
    "primary-content": defaultColors["primary-content"],

    secondary: defaultColors.secondary,
    "secondary-focus": defaultColors["secondary-focus"],
    "secondary-content": defaultColors["secondary-content"],

    accent: defaultColors.accent,
    "accent-focus": defaultColors["accent-focus"],
    "accent-content": defaultColors["accent-content"],

    neutral: defaultColors.neutral,
    "neutral-focus": defaultColors["neutral-focus"],
    "neutral-content": defaultColors["neutral-content"],

    "base-100": defaultColors["base-100"],
    "base-200": defaultColors["base-200"],
    "base-300": defaultColors["base-300"],
    "base-content": defaultColors["base-content"],

    info: defaultColors.info,
    "info-content": defaultColors["info-content"],

    success: defaultColors.success,
    "success-content": defaultColors["success-content"],

    warning: defaultColors.warning,
    "warning-content": defaultColors["warning-content"],

    error: defaultColors.error,
    "error-content": defaultColors["error-content"],

    // Utility colors
    white: defaultColors.white,
    black: defaultColors.black,
    overlay: defaultColors.overlay,

    // React Native Reusables color tokens (mapped to DaisyUI)
    input: defaultColors["base-300"],           // Border color
    "primary-foreground": defaultColors["primary-content"], // Text on primary
    destructive: defaultColors.error,           // Error color
    ring: defaultColors.primary,                // Focus ring (primary color)
  },
};

// Dark theme with proper dark mode colors
const darkTheme: Colors["dark"] = {
  dark: true,
  fonts: navigationFonts,
  mode: "dark",
  colors: {
    // React Navigation required properties (mapped to DaisyUI equivalents)
    primary: tealPalette[400],       // Lighter teal for dark mode
    background: "#121212",           // Maps to base-100
    card: "#1E1E1E",                 // Maps to base-200
    text: "#E5E5E5",                 // Maps to base-content
    border: grayPalette[800],        // Maps to base-300
    notification: bluePalette[400],  // Maps to info

    // Text color utilities (used by Button for contrast calculations)
    textLight: "#FFFFFF",            // White text for dark backgrounds
    textDark: "#E5E5E5",             // Light gray text (base-content)

    // DaisyUI theme variables
    "primary-focus": tealPalette[300], // Even lighter for hover
    "primary-content": grayPalette[900], // Dark text on primary

    secondary: tealPalette[400],
    "secondary-focus": tealPalette[300],
    "secondary-content": grayPalette[900],

    accent: tealPalette[200],        // Very light teal for dark mode
    "accent-focus": tealPalette[100],
    "accent-content": grayPalette[900],

    neutral: grayPalette[700],       // Medium gray for dark mode
    "neutral-focus": grayPalette[600], // Lighter gray for hover
    "neutral-content": grayPalette[200], // Light text on neutral

    "base-100": "#121212",           // Dark background (obsidian)
    "base-200": "#1E1E1E",           // Slightly lighter
    "base-300": grayPalette[800],    // Even lighter
    "base-content": "#E5E5E5",       // Light text on dark

    info: bluePalette[400],
    "info-content": bluePalette[50],

    success: "#66BB6A",              // Lighter green for dark mode
    "success-content": grayPalette[900],

    warning: "#FFA726",              // Lighter orange for dark mode
    "warning-content": grayPalette[900],

    error: "#EF5350",                // Slightly lighter red
    "error-content": "#FFFFFF",

    // Utility colors
    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.7)",   // Darker overlay for dark mode

    // React Native Reusables color tokens (mapped to DaisyUI)
    input: grayPalette[800],          // Border color for dark mode
    "primary-foreground": grayPalette[900], // Text on primary (dark text on light primary)
    destructive: "#EF5350",           // Error color for dark mode
    ring: tealPalette[400],           // Focus ring (lighter primary for dark mode)
  },
};

export const colors: Colors = {
  base: defaultColors,
  light: lightTheme,
  dark: darkTheme,
};

// Helper function to get current theme colors
export const getThemeColors = (isDark: boolean) => {
  return isDark ? colors.dark.colors : colors.light.colors;
};

// Utility for accessing semantic colors
export const semanticColors = {
  background: {
    primary: (isDark: boolean) => getThemeColors(isDark)["base-100"],
    secondary: (isDark: boolean) => getThemeColors(isDark)["base-200"],
    tertiary: (isDark: boolean) => getThemeColors(isDark)["base-300"],
  },
  text: {
    primary: (isDark: boolean) => getThemeColors(isDark)["base-content"],
    onPrimary: (isDark: boolean) => getThemeColors(isDark)["primary-content"],
    onSecondary: (isDark: boolean) => getThemeColors(isDark)["secondary-content"],
  },
  action: {
    primary: (isDark: boolean) => getThemeColors(isDark).primary,
    primaryFocus: (isDark: boolean) => getThemeColors(isDark)["primary-focus"],
    secondary: (isDark: boolean) => getThemeColors(isDark).secondary,
    secondaryFocus: (isDark: boolean) => getThemeColors(isDark)["secondary-focus"],
    positive: (isDark: boolean) => getThemeColors(isDark).accent,
    positiveFocus: (isDark: boolean) => getThemeColors(isDark)["accent-focus"],
  },
  feedback: {
    info: (isDark: boolean) => getThemeColors(isDark).info,
    success: (isDark: boolean) => getThemeColors(isDark).success,
    warning: (isDark: boolean) => getThemeColors(isDark).warning,
    error: (isDark: boolean) => getThemeColors(isDark).error,
  },
};
