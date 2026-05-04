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

const isReactNativeRuntime =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";
const isWebRuntime = typeof document !== "undefined" && !isReactNativeRuntime;

const serifFamilies = isWebRuntime
  ? { regular: "Georgia, 'Times New Roman', serif", bold: "Georgia, 'Times New Roman', serif" }
  : { regular: "Georgia", bold: "Georgia" };

const sansSerifFamilies = isWebRuntime
  ? {
    regular: `"Lato", ${WEB_FONT_STACK}`,
    bold: `"Lato", ${WEB_FONT_STACK}`,
  }
  : isReactNativeRuntime
    ? {
      regular: "System",
      bold: "System",
    }
    : {
      regular: "sans-serif",
      bold: "sans-serif",
    };

export const fontFamilies = {
  serif: serifFamilies,
  sansSerif: sansSerifFamilies,
};

// Navigation theme fonts configuration
/**
 * Typography scale — Tailwind-matching sizes for consistent text hierarchy.
 * Components can progressively adopt these tokens.
 */
export type TypographySize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export const typography: Record<TypographySize, { fontSize: number; lineHeight: number }> = {
  xs:   { fontSize: 12, lineHeight: 16 },
  sm:   { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg:   { fontSize: 18, lineHeight: 28 },
  xl:   { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 32 },
  "3xl": { fontSize: 30, lineHeight: 36 },
  "4xl": { fontSize: 36, lineHeight: 40 },
};

const webNavigationFonts: NavigationFonts = {
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
};

const nativeNavigationFonts: NavigationFonts = {
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
};

const defaultNavigationFonts: NavigationFonts = {
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
};

// Navigation theme fonts configuration
export const navigationFonts: NavigationFonts = isWebRuntime
  ? webNavigationFonts
  : isReactNativeRuntime
    ? nativeNavigationFonts
    : defaultNavigationFonts;
