import { navigationFonts } from "./fonts";

export interface Colors {
  base: {
    black: string;
    charcoal: string;
    error: string;
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
    inactive: string;
    lightGray: string;
    navy: string;
    obsidian: string;
    success: string;
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
    white: string;
    warmGray: string;
    warmPaper: string;
    mutedNavy: string;
  };
  dark: Theme;
  light: Theme;
}

export interface Theme {
  colors: {
    accent: string;
    background: string;
    border: string;
    card: string;
    error: string;
    icon: string;
    link: string;
    notification: string;
    placeholder: string;
    primary: string;
    secondary: string;
    secondaryText: string;
    shadow: string;
    success: string;
    tabIconDefault: string;
    tabIconSelected: string;
    text: string;
    textDark: string;
    textLight: string;
    tint: string;
  };
  dark: boolean;
  fonts: typeof navigationFonts;
  mode: "light" | "dark";
}

const defaultColors: Colors["base"] = {
  black: "#000000",
  charcoal: "#2C2C2C",
  error: "#FF5252",
  gray: {
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
  },
  inactive: "#757575",
  lightGray: "#EEEEEE",
  navy: "#0A3A60",
  obsidian: "#121212",
  success: "#4CAF50",
  teal: {
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
  },
  white: "#FFFFFF",
  warmGray: "#D1CBC5",
  warmPaper: "#F4F5F7",
  mutedNavy: "#336699",
};

const lightTheme: Colors["light"] = {
  dark: false,
  fonts: navigationFonts,
  mode: "light",
  colors: {
    accent: defaultColors.teal[500],
    background: defaultColors.warmPaper,
    border: defaultColors.gray[300],
    card: defaultColors.gray[50],
    error: defaultColors.error,
    icon: defaultColors.teal[600],
    link: defaultColors.teal[500],
    notification: defaultColors.teal[50],
    placeholder: defaultColors.gray[500],
    primary: defaultColors.teal[500],
    secondary: defaultColors.teal[300],
    secondaryText: defaultColors.gray[600],
    shadow: `${defaultColors.black}10`,
    success: defaultColors.success,
    tabIconDefault: defaultColors.gray[600],
    tabIconSelected: defaultColors.teal[500],
    text: defaultColors.charcoal,
    textDark: defaultColors.black,
    textLight: defaultColors.white,
    tint: defaultColors.teal[500],
  },
};

const darkTheme: Colors["dark"] = {
  dark: true,
  fonts: navigationFonts,
  mode: "dark",
  colors: {
    accent: defaultColors.teal[400],
    background: defaultColors.obsidian,
    border: defaultColors.gray[800],
    card: defaultColors.gray[700],
    error: defaultColors.error,
    icon: defaultColors.teal[300],
    link: defaultColors.teal[400],
    notification: defaultColors.teal[900],
    placeholder: defaultColors.gray[500],
    primary: defaultColors.teal[400],
    secondary: defaultColors.teal[200],
    secondaryText: defaultColors.gray[300],
    shadow: "rgba(19, 78, 74, 0.4)",
    success: defaultColors.success,
    tabIconDefault: defaultColors.gray[600],
    tabIconSelected: defaultColors.teal[400],
    text: defaultColors.white,
    textDark: defaultColors.black,
    textLight: defaultColors.white,
    tint: defaultColors.teal[400],
  },
};

export const colors: Colors = {
  base: defaultColors,
  light: lightTheme,
  dark: darkTheme,
};
