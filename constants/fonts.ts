import { Platform } from "react-native";

// Type for allowed font weights in React Navigation v7
type NavigationFontWeight =
  | "normal"
  | "bold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";

// Font style interface
interface FontStyle {
  fontFamily: string;
  fontWeight: NavigationFontWeight;
}

// Navigation fonts interface
interface NavigationFonts {
  regular: FontStyle;
  medium: FontStyle;
  bold: FontStyle;
  heavy: FontStyle;
}

// Web font stack fallback
const WEB_FONT_STACK =
  "system-ui, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\"";

export const fontFamilies = {
  serif: {
    regular: "Merriweather-Regular",
    bold: "Merriweather-Bold",
  },
  sansSerif: {
    regular: "Lato-Regular",
    bold: "Lato-Bold",
  },
};

// Navigation theme fonts configuration
export const navigationFonts: NavigationFonts = Platform.select({
  web: {
    regular: {
      fontFamily: fontFamilies.sansSerif.regular || WEB_FONT_STACK,
      fontWeight: "400",
    },
    medium: {
      fontFamily: fontFamilies.sansSerif.regular || WEB_FONT_STACK,
      fontWeight: "500",
    },
    bold: {
      fontFamily: fontFamilies.sansSerif.bold || WEB_FONT_STACK,
      fontWeight: "600",
    },
    heavy: {
      fontFamily: fontFamilies.sansSerif.bold || WEB_FONT_STACK,
      fontWeight: "700",
    },
  },
  ios: {
    regular: {
      fontFamily: fontFamilies.sansSerif.regular || "System",
      fontWeight: "400",
    },
    medium: {
      fontFamily: fontFamilies.sansSerif.regular || "System",
      fontWeight: "500",
    },
    bold: {
      fontFamily: fontFamilies.sansSerif.bold || "System",
      fontWeight: "600",
    },
    heavy: {
      fontFamily: fontFamilies.sansSerif.bold || "System",
      fontWeight: "700",
    },
  },
  default: {
    regular: {
      fontFamily: fontFamilies.sansSerif.regular || "sans-serif",
      fontWeight: "normal",
    },
    medium: {
      fontFamily: fontFamilies.sansSerif.regular || "sans-serif-medium",
      fontWeight: "normal",
    },
    bold: {
      fontFamily: fontFamilies.sansSerif.bold || "sans-serif",
      fontWeight: "600",
    },
    heavy: {
      fontFamily: fontFamilies.sansSerif.bold || "sans-serif",
      fontWeight: "700",
    },
  },
});
