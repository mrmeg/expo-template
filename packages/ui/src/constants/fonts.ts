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
// A web bundle is also evaluated in Node when a host app's HTML shell is
// rendered at export time, where both are `undefined` while the browser sees
// them — that produces different module-load snapshots and a hydration
// mismatch on every <StyledText>. `Platform.OS` (from react-native-web)
// returns "web" in both environments, so the value is stable.
const isWebRuntime = Platform.OS === "web";
const isReactNativeRuntime = Platform.OS !== "web";

// Georgia ships as one face per platform; every weight slot points at the
// same family and weight differentiation only appears when a host app
// overrides serif with real per-weight faces via `setFonts`.
const webSerifFamily = "Georgia, 'Times New Roman', serif";
const serifFamilies = isWebRuntime
  ? {
    light: webSerifFamily,
    regular: webSerifFamily,
    medium: webSerifFamily,
    semibold: webSerifFamily,
    bold: webSerifFamily,
  }
  : {
    light: "Georgia",
    regular: "Georgia",
    medium: "Georgia",
    semibold: "Georgia",
    bold: "Georgia",
  };

// Same single-face story as serif: the package doesn't bundle a mono font, it
// leans on each platform's system monospace. Menlo on iOS ("monospace" isn't
// a resolvable family name there); Android resolves "monospace" natively.
const WEB_MONO_STACK =
  "ui-monospace, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace";
const nativeMonoFamily = Platform.OS === "ios" ? "Menlo" : "monospace";
const monoFamilies = isWebRuntime
  ? {
    light: WEB_MONO_STACK,
    regular: WEB_MONO_STACK,
    medium: WEB_MONO_STACK,
    semibold: WEB_MONO_STACK,
    bold: WEB_MONO_STACK,
  }
  : {
    light: nativeMonoFamily,
    regular: nativeMonoFamily,
    medium: nativeMonoFamily,
    semibold: nativeMonoFamily,
    bold: nativeMonoFamily,
  };

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

/** Weight slots every sans-serif family map must provide. */
export type FontFamilyWeight = "light" | "regular" | "medium" | "semibold" | "bold";

/**
 * How a platform expresses weight for a given family map.
 *
 * - `"numeric"` — one multi-weight CSS family (the package's own web default:
 *   a single `"Inter"` family where a numeric `fontWeight` selects the
 *   `@font-face` variant).
 * - `"family"` — each weight is its own separately-registered single-face
 *   family, so the family name alone carries the weight. Emitting a numeric
 *   `fontWeight` on top of one makes the renderer synthesise a second layer of
 *   bold, so `StyledText` suppresses it.
 *
 * Native is always `"family"` (discrete static font files). Web is `"numeric"`
 * by default, but apps that load per-weight faces through `expo-font` — which
 * registers each file as its own family on web too — must declare `"family"`.
 */
export type FontWeightStrategy = "numeric" | "family";

/** The font variants text components can render. */
export type FontVariant = "sansSerif" | "serif" | "mono";

export type FontFamilyMap = Record<FontVariant, Record<FontFamilyWeight, string>>;

/**
 * A per-variant override group. Partial per weight: missing weights fall back
 * to the group's own `regular` (not the package default), so an app that
 * registers only Regular + Medium never leaks a package face into its brand.
 */
export type FontFamilyOverride = Partial<Record<FontFamilyWeight, string>>;

/**
 * Font overrides a host app can inject to brand the package.
 *
 * Mirrors `setColors`: the package ships neutral defaults, but a consuming app
 * almost always bundles its own faces. Without an injection point, package
 * components render the package's fonts while app-authored siblings render the
 * app's — and the only remaining lever is patching `node_modules`, which is
 * keyed to an exact version and silently stops applying on the next bump.
 *
 * Partial by design: override `sansSerif` alone and `serif`/`mono` keep their
 * defaults.
 */
export type FontOverrides = {
  families?: Partial<Record<FontVariant, FontFamilyOverride>>;
  /** Defaults to the package's own per-platform behaviour when omitted. */
  webWeightStrategy?: FontWeightStrategy;
};

/** The package's built-in families. Override per-app via `setFonts`. */
export const fontFamilies: FontFamilyMap = {
  serif: serifFamilies,
  sansSerif: sansSerifFamilies,
  mono: monoFamilies,
};

/**
 * The package's own web weight strategy: one multi-weight "Inter" family, so
 * weight comes from a numeric `fontWeight`. Native always behaves as
 * `"family"` regardless of this value.
 */
export const defaultWebWeightStrategy: FontWeightStrategy = "numeric";

/**
 * Web-only numeric weights, used under the `"numeric"` strategy to pick the
 * right `@font-face` variant out of a single multi-weight CSS family.
 * `light` has no loaded 300 weight (mirrors the native light->regular file
 * mapping above), so it renders at 400 like `regular`.
 */
const WEB_FONT_WEIGHTS: Record<FontFamilyWeight, "400" | "500" | "600" | "700"> = {
  light: "400",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export type ResolvedFontStyle = {
  fontFamily: string;
  /** Present only under the `"numeric"` weight strategy (web). */
  fontWeight?: "400" | "500" | "600" | "700";
};

/**
 * Resolve the `fontFamily` (+ optional numeric `fontWeight`) for a variant and
 * weight, honouring any host-app `setFonts` overrides.
 *
 * This is the single source of truth every text-rendering component goes
 * through — `StyledText` directly, control components via `useFontStyle` —
 * so a host override re-skins package text everywhere at once.
 *
 * Weight is carried either by a numeric `fontWeight` (one multi-weight CSS
 * family) or by the family name itself (discrete per-weight faces). Native is
 * always the latter: adding a numeric weight on top of an already-bold file
 * faux-bolds it. Web defaults to numeric for the package's own single "Inter"
 * family, but an app loading per-weight faces through `expo-font` gets its
 * own family per weight on web too, and must declare
 * `webWeightStrategy: "family"` to avoid a second synthesised layer of bold.
 */
export function resolveFontStyle(
  overrides: FontOverrides,
  variant: FontVariant,
  weight: FontFamilyWeight,
): ResolvedFontStyle {
  const defaults = fontFamilies[variant];
  const overrideGroup = overrides.families?.[variant];
  const fontFamily = overrideGroup
    ? overrideGroup[weight] ?? overrideGroup.regular ?? defaults[weight]
    : defaults[weight];

  const strategy = Platform.OS === "web"
    ? overrides.webWeightStrategy ?? defaultWebWeightStrategy
    : "family";

  return strategy === "numeric"
    ? { fontFamily, fontWeight: WEB_FONT_WEIGHTS[weight] }
    : { fontFamily };
}

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
