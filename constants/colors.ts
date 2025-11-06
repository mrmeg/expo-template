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

    "base-100": string;  // Main background
    "base-200": string;  // Card/elevated background
    "base-300": string;  // Borders and dividers
    "base-content": string;  // Main text color

    success: string;
    warning: string;
    error: string;

    // Utility colors
    white: string;
    black: string;
    overlay: string;
    textLight: string;   // Light text for dark backgrounds
    textDark: string;    // Dark text for light backgrounds
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

    "base-100": "#FFFFFF",
    "base-200": "#F4F5F7",
    "base-300": "#E9ECEF",
    "base-content": "#2C2C2C",

    success: "#4CAF50",
    warning: "#F59E0B",
    error: "#FF5252",

    // Utility colors
    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.5)",
    textLight: "#FFFFFF",
    textDark: "#000000",
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

    "base-100": "#121212",
    "base-200": "#1E1E1E",
    "base-300": "#343A40",
    "base-content": "#E5E5E5",

    success: "#66BB6A",
    warning: "#FFA726",
    error: "#EF5350",

    // Utility colors
    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.7)",
    textLight: "#FFFFFF",
    textDark: "#000000",
  },
};

export const colors: Colors = {
  light: lightTheme,
  dark: darkTheme,
};
