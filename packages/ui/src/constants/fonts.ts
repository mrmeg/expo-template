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

// IMPORTANT: do NOT key these on `typeof document` / `typeof navigator`.
// On a web bundle, Node SSR sees `undefined` for both and the client sees them,
// producing different snapshot values at module load -> hydration mismatch on
// every <StyledText>. `Platform.OS` (from react-native-web) returns "web" in
// both environments, so the value is stable.
const isWebRuntime = Platform.OS === "web";
const isReactNativeRuntime = Platform.OS !== "web";

const serifFamilies = isWebRuntime
  ? { regular: "Georgia, 'Times New Roman', serif", bold: "Georgia, 'Times New Roman', serif" }
  : { regular: "Georgia", bold: "Georgia" };

// Web ships one Inter CSS family for every weight — weight differentiation
// comes from a numeric `fontWeight` set alongside this family (see
// StyledText's getFontFamilyWeight). Native ships four discrete Inter static
// font files (loaded by useResources via @expo-google-fonts/inter), each a
// real weight, so the family name alone carries the weight — do NOT also set
// `fontWeight` on native or it faux-bolds on top of an already-bold file.
// `light` maps to the regular file on native: a 5th (300) static weight isn't
// worth shipping for how rarely `light` is used.
const sansSerifFamilies = isWebRuntime
  ? {
    light: `"Inter", ${WEB_FONT_STACK}`,
    regular: `"Inter", ${WEB_FONT_STACK}`,
    medium: `"Inter", ${WEB_FONT_STACK}`,
    semibold: `"Inter", ${WEB_FONT_STACK}`,
    bold: `"Inter", ${WEB_FONT_STACK}`,
  }
  : isReactNativeRuntime
    ? {
      light: "Inter_400Regular",
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
    }
    : {
      light: "sans-serif",
      regular: "sans-serif",
      medium: "sans-serif",
      semibold: "sans-serif",
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

// Web: single "Inter" family per weight slot, numeric fontWeight picks the
// right @font-face variant from the multi-weight stylesheet (see useResources).
const webNavigationFonts: NavigationFonts = {
  regular: {
    fontFamily: fontFamilies.sansSerif.regular || WEB_FONT_STACK,
    fontWeight: "400",
  },
  medium: {
    fontFamily: fontFamilies.sansSerif.medium || WEB_FONT_STACK,
    fontWeight: "500",
  },
  bold: {
    fontFamily: fontFamilies.sansSerif.semibold || WEB_FONT_STACK,
    fontWeight: "600",
  },
  heavy: {
    fontFamily: fontFamilies.sansSerif.bold || WEB_FONT_STACK,
    fontWeight: "700",
  },
};

// Native: each slot points at its own real Inter static file, so the family
// name alone carries the weight. No numeric fontWeight here — pairing one
// with an already-weighted static file triggers faux-bold on top of a real
// weight file (same rule as StyledText's getFontFamilyWeight).
const nativeNavigationFonts: NavigationFonts = {
  regular: {
    fontFamily: fontFamilies.sansSerif.regular || "System",
    fontWeight: "normal",
  },
  medium: {
    fontFamily: fontFamilies.sansSerif.medium || "System",
    fontWeight: "normal",
  },
  bold: {
    fontFamily: fontFamilies.sansSerif.semibold || "System",
    fontWeight: "normal",
  },
  heavy: {
    fontFamily: fontFamilies.sansSerif.bold || "System",
    fontWeight: "normal",
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
