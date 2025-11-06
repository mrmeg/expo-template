import { navigationFonts } from "./fonts";

export interface Colors {
  dark: Theme;
  light: Theme;
}

export interface Theme {
  colors: {
    // React Navigation required properties
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;

    // Additional theme colors (actively used)
    secondary: string;
    neutral: string;

    // Backgrounds (clear hierarchy)
    bgPrimary: string;      // Main background
    bgSecondary: string;    // Elevated/cards
    bgTertiary: string;     // Borders/dividers

    // Text colors (clear purpose)
    textPrimary: string;    // Main text color
    textOnDark: string;     // Light text for dark backgrounds
    textOnLight: string;    // Dark text for light backgrounds

    // Semantic states
    success: string;
    warning: string;
    error: string;

    // Utility colors
    white: string;
    black: string;
    overlay: string;
  };
  dark: boolean;
  fonts: typeof navigationFonts;
  mode: "light" | "dark";
}

// Simplified teal palette (only values actually used in themes)
const teal = {
  200: "#99f6e4",
  300: "#5eead4",
  400: "#2dd4bf",  // Primary brand color
  500: "#14b8a6",
  600: "#0d9488",
};

const lightTheme: Colors["light"] = {
  dark: false,
  fonts: navigationFonts,
  mode: "light",
  colors: {
    // React Navigation required properties
    primary: teal[400],
    background: "#FFFFFF",
    card: "#F4F5F7",
    text: "#2C2C2C",
    border: "#E9ECEF",
    notification: teal[400],

    // Additional theme colors
    secondary: teal[500],
    neutral: "#6C757D",

    // Backgrounds
    bgPrimary: "#FFFFFF",
    bgSecondary: "#F4F5F7",
    bgTertiary: "#E9ECEF",

    // Text colors
    textPrimary: "#2C2C2C",
    textOnDark: "#FFFFFF",
    textOnLight: "#000000",

    // Semantic states
    success: "#4CAF50",
    warning: "#F59E0B",
    error: "#FF5252",

    // Utility colors
    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
};

const darkTheme: Colors["dark"] = {
  dark: true,
  fonts: navigationFonts,
  mode: "dark",
  colors: {
    // React Navigation required properties
    primary: teal[400],
    background: "#121212",
    card: "#1E1E1E",
    text: "#E5E5E5",
    border: "#343A40",
    notification: teal[400],

    // Additional theme colors
    secondary: teal[400],
    neutral: "#495057",

    // Backgrounds
    bgPrimary: "#121212",
    bgSecondary: "#1E1E1E",
    bgTertiary: "#343A40",

    // Text colors
    textPrimary: "#E5E5E5",
    textOnDark: "#FFFFFF",
    textOnLight: "#000000",

    // Semantic states
    success: "#66BB6A",
    warning: "#FFA726",
    error: "#EF5350",

    // Utility colors
    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

export const colors: Colors = {
  light: lightTheme,
  dark: darkTheme,
};
