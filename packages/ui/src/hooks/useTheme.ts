import { useCallback, useEffect, useMemo } from "react";
import { Colors, colors } from "../constants/colors";
import { ViewStyle, Platform, StyleSheet } from "react-native";
import { resolveThemePreference, useThemeStore } from "../state/themeStore";
import { useThemeColorScope } from "../state/themeColorScope";
import { spacing as spacingConstants } from "../constants/spacing";

type ShadowType =
  | "base"
  | "soft"
  | "sharp"
  | "subtle"
  | "elevated"
  | "glow"
  | "glass"
  | "card"
  | "cardHover"
  | "cardSubtle";

// Module-level cache for contrast calculations to avoid memory leak
// and share across components
const contrastCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

function getCachedOrCompute(key: string, compute: () => string): string {
  if (contrastCache.has(key)) {
    return contrastCache.get(key)!;
  }
  // Prevent unbounded growth
  if (contrastCache.size >= MAX_CACHE_SIZE) {
    const firstKey = contrastCache.keys().next().value;
    if (firstKey) contrastCache.delete(firstKey);
  }
  const result = compute();
  contrastCache.set(key, result);
  return result;
}

interface ExtendedColorScheme {
  theme: Colors["light" | "dark"];
  scheme: "light" | "dark";
  // Shadow helper function
  getShadowStyle: (type: ShadowType) => ViewStyle;
  getFocusRingStyle: (offset?: number) => ViewStyle;
  // Color utility methods
  getContrastingColor: (backgroundColor: string, color1?: string, color2?: string) => string;
  getTextColorForBackground: (backgroundColor: string) => "light" | "dark";
  withAlpha: (color: string, alpha: number) => string;
  getContrastRatio: (color1: string, color2: string) => number;
}

/**
 * useTheme
 *
 * Provides access to app colors, theme styles, and utilities for color contrast.
 * Includes helpers to determine readable text color for any background.
 *
 * Returns:
 * - theme: active theme colors (light or dark)
 * - scheme: "light" | "dark"
 * - getShadowStyle(type): returns cross-platform shadow style object
 * - getFocusRingStyle(offset): returns web focus ring style object
 * - getContrastingColor(bg, color1?, color2?): pick best contrast of two options
 * - getTextColorForBackground(bg): returns "light" or "dark"
 * - withAlpha(color, alpha): adds transparency
 * - getContrastRatio(color1, color2): returns numeric WCAG contrast ratio
 *
 * Examples:
 * - getTextColorForBackground("#000") → "light"
 * - getContrastingColor("#f4f4f4", "#222", "#fff") → "#222"
 * - withAlpha("#336699", 0.6) → "rgba(51,102,153,0.6)"
 * - getShadowStyle('base') → { boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.05), 0px 4px 12px rgba(0, 0, 0, 0.03)" }
 */
export function useTheme(): ExtendedColorScheme & {
  toggleTheme: () => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  currentTheme: "system" | "light" | "dark";
  } {
  const userTheme = useThemeStore((s) => s.userTheme);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const colorOverrides = useThemeStore((s) => s.colorOverrides);
  const scoped = useThemeColorScope();

  // Determine which theme to use (user preference or system)
  const effectiveScheme = resolveThemePreference(userTheme, systemTheme);
  const base = colors[effectiveScheme];

  // Layer overrides on top of the package defaults for the active scheme, in
  // precedence order: package default → global store (app brand) → scoped
  // context (per-subtree, e.g. a survey theme). When neither override is
  // present we return the base theme *by reference* so memoization and identity
  // checks downstream stay stable (and the package behaves exactly as it did
  // before overrides existed).
  const storeOverride = colorOverrides[effectiveScheme]; // global app brand
  const scopedOverride = scoped?.[effectiveScheme];       // subtree override
  const theme = useMemo(() => {
    const hasStore = storeOverride && Object.keys(storeOverride).length > 0;
    const hasScoped = scopedOverride && Object.keys(scopedOverride).length > 0;
    if (!hasStore && !hasScoped) {
      return base; // identity preserved — no allocation, stable references
    }
    return {
      ...base,
      colors: { ...base.colors, ...storeOverride, ...scopedOverride },
    };
  }, [base, storeOverride, scopedOverride]);

  // Sync theme to DOM so CSS in +html.tsx follows the app's runtime theme
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.dataset.theme = effectiveScheme;
      document.documentElement.style.colorScheme = effectiveScheme;
    }
  }, [effectiveScheme]);

  // Toggle between light, dark, and system themes
  const toggleTheme = useCallback(() => {
    if (userTheme === "light") {
      setTheme("dark");
    } else if (userTheme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }, [setTheme, userTheme]);

  /**
   * getShadowStyle
   * Returns a cross-platform shadow style using the `boxShadow` style prop.
   *
   * RN 0.85 + react-native-web 0.21 deprecate the legacy `shadow*` props in
   * favor of `boxShadow`, which is supported on both native and web. Because
   * `boxShadow` has no separate opacity field, each preset's opacity is folded
   * into the color's alpha via `withAlpha`. `elevation` is dropped — `boxShadow`
   * renders shadows on Android in 0.85+.
   *
   * Every preset (except `sharp` and `glow`, which are deliberately
   * single-layer) is a dual-layer shadow: a tight "contact" layer plus a
   * wider, softer "ambient" layer, pitsi-ui-style. Layers are comma-joined
   * into one `boxShadow` value.
   */
  const getShadowStyle = useCallback((type: ShadowType): ViewStyle => {
    // Each preset is one or more layers of [offsetX, offsetY, blurRadius, color, opacity].
    // Darker themes get a stronger alpha so shadows stay visible.
    const boost = theme.dark ? 3 : 1;
    const overlay = theme.colors.overlay;
    const shadowConfigs: Record<
      ShadowType,
      { x: number; y: number; blur: number; color: string; opacity: number }[]
    > = {
      subtle: [
        { x: 0, y: 1, blur: 3, color: overlay, opacity: 0.04 },
        { x: 0, y: 2, blur: 8, color: overlay, opacity: 0.03 },
      ],
      base: [
        { x: 0, y: 2, blur: 6, color: overlay, opacity: 0.05 },
        { x: 0, y: 4, blur: 12, color: overlay, opacity: 0.03 },
      ],
      soft: [
        { x: 0, y: 4, blur: 10, color: overlay, opacity: 0.05 },
        { x: 0, y: 8, blur: 20, color: overlay, opacity: 0.03 },
      ],
      card: [
        { x: 0, y: 4, blur: 12, color: overlay, opacity: 0.05 },
        { x: 0, y: 8, blur: 24, color: overlay, opacity: 0.03 },
      ],
      cardSubtle: [
        { x: 0, y: 1, blur: 3, color: overlay, opacity: 0.05 },
        { x: 0, y: 3, blur: 9, color: overlay, opacity: 0.03 },
      ],
      cardHover: [
        { x: 0, y: 8, blur: 24, color: overlay, opacity: 0.06 },
        { x: 0, y: 16, blur: 48, color: overlay, opacity: 0.04 },
      ],
      elevated: [
        { x: 0, y: 16, blur: 48, color: overlay, opacity: 0.08 },
        { x: 0, y: 32, blur: 96, color: overlay, opacity: 0.05 },
      ],
      glass: [
        { x: 0, y: 4, blur: 30, color: overlay, opacity: 0.05 },
        { x: 0, y: 8, blur: 60, color: overlay, opacity: 0.03 },
      ],
      // Single layer — intentional crispness, not a soft dual-layer shadow.
      sharp: [
        { x: 0, y: 1, blur: 1, color: overlay, opacity: 0.15 },
      ],
      // Single layer — already a deliberate, vivid accent glow.
      glow: [
        { x: 0, y: 4, blur: 20, color: theme.colors.primary, opacity: 0.4 },
      ],
    };

    const layers = shadowConfigs[type].map(({ x, y, blur, color, opacity }) => {
      // Don't boost the glow accent — it's already a deliberate, vivid alpha.
      const alpha = color === theme.colors.primary ? opacity : Math.min(opacity * boost, 1);
      return `${x}px ${y}px ${blur}px ${withAlpha(color, alpha)}`;
    });

    return {
      boxShadow: layers.join(", "),
    } as ViewStyle;
  }, [theme]);

  const getFocusRingStyle = useCallback((offset = 2): ViewStyle => {
    if (Platform.OS !== "web") {
      return {};
    }

    return {
      boxShadow: `0 0 0 ${offset}px ${theme.colors.background}, 0 0 0 ${offset + 2}px ${theme.colors.ring}`,
    } as ViewStyle;
  }, [theme.colors.background, theme.colors.ring]);

  // Helper to calculate contrast ratio between two colors
  const getContrastRatio = useCallback((color1: string, color2: string): number => {
    const rgb1 = parseColor(color1);
    const rgb2 = parseColor(color2);

    if (!rgb1 || !rgb2) {
      console.error("Invalid colors for contrast ratio:", color1, color2);
      return 1; // Default to minimum contrast
    }

    const lum1 = calculateLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = calculateLuminance(rgb2[0], rgb2[1], rgb2[2]);

    return calculateContrastRatio(lum1, lum2);
  }, []);

  // Cached version of getContrastingColor for performance
  // Uses module-level cache to prevent memory leak
  const getCachedContrastingColor = useCallback((
    backgroundColor: string,
    color1?: string,
    color2?: string
  ): string => {
    const cacheKey = `${backgroundColor}-${color1}-${color2}`;
    return getCachedOrCompute(cacheKey, () =>
      getBetterContrast(backgroundColor, color1, color2)
    );
  }, []);

  return useMemo(() => ({
    theme,
    scheme: theme.dark ? "dark" : "light",
    getShadowStyle,
    getFocusRingStyle,
    toggleTheme,
    setTheme,
    currentTheme: userTheme,
    getContrastingColor: getCachedContrastingColor,
    getTextColorForBackground,
    withAlpha,
    getContrastRatio,
  }), [
    getCachedContrastingColor,
    getContrastRatio,
    getFocusRingStyle,
    getShadowStyle,
    setTheme,
    theme,
    toggleTheme,
    userTheme,
  ]);
}




/**
 * Parses a color string (hex or rgba) and returns RGB values.
 * @param color - The color string (hex or rgba format)
 * @returns An array of [red, green, blue, alpha] values (RGB 0-255, alpha 0-1) or null if invalid.
 */
function parseColor(color: string): [number, number, number, number] | null {
  // Check if it's an rgba string
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10),
      rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    ];
  }

  // Otherwise, try to parse as hex
  const rgb = hexToRgb(color);
  return rgb ? [...rgb, 1] : null; // Add alpha=1 for hex colors
}




/**
 * Converts a hexadecimal color code to RGB values.
 * @param hex - The hexadecimal color code (e.g., "#RRGGBB" or "#RGB").
 * @returns An array of [red, green, blue] values (0-255) or null if invalid.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  // Check if already in rgba format
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
    const rgbValues = parseColor(hex);
    return rgbValues ? [rgbValues[0], rgbValues[1], rgbValues[2]] : null;
  }

  // Remove the hash if it exists
  hex = hex.replace(/^#/, "");

  // Handle shorthand hex (#RGB)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Handle standard hex (#RRGGBB)
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ]
    : null;
}




/**
 * Calculates the relative luminance of a color according to WCAG guidelines.
 * @param r - Red component (0-255).
 * @param g - Green component (0-255).
 * @param b - Blue component (0-255).
 * @returns The relative luminance value (0-1).
 */
function calculateLuminance(r: number, g: number, b: number): number {
  // Convert RGB to sRGB
  const sRGB = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928
      ? v / 12.92
      : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance using WCAG formula
  return sRGB[0] * 0.2126 + sRGB[1] * 0.7152 + sRGB[2] * 0.0722;
}




/**
 * Calculates the contrast ratio between two colors according to WCAG guidelines.
 * @param lum1 - First color's luminance.
 * @param lum2 - Second color's luminance.
 * @returns The contrast ratio (1-21).
 */
function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighterLum = Math.max(lum1, lum2);
  const darkerLum = Math.min(lum1, lum2);
  return (lighterLum + 0.05) / (darkerLum + 0.05);
}




/**
 * Determines the color with better contrast against the background.
 * @param backgroundColor - The background color in hex or rgba format.
 * @param color1 - First color option in hex format (default: "#FFFFFF").
 * @param color2 - Second color option in hex format (default: "#000000").
 * @returns The hex color code of the color with better contrast.
 */
function getBetterContrast(
  backgroundColor: string,
  color1: string = "#FFFFFF",
  color2: string = "#000000"
): string {
  const bgColor = parseColor(backgroundColor);
  const color1Rgb = parseColor(color1);
  const color2Rgb = parseColor(color2);

  if (!bgColor || !color1Rgb || !color2Rgb) {
    return "#000000"; // Default to black if any color is invalid
  }

  // For semi-transparent backgrounds, we'll consider their luminance directly
  const bgLuminance = calculateLuminance(bgColor[0], bgColor[1], bgColor[2]);
  const color1Luminance = calculateLuminance(color1Rgb[0], color1Rgb[1], color1Rgb[2]);
  const color2Luminance = calculateLuminance(color2Rgb[0], color2Rgb[1], color2Rgb[2]);

  const contrast1 = calculateContrastRatio(bgLuminance, color1Luminance);
  const contrast2 = calculateContrastRatio(bgLuminance, color2Luminance);

  return contrast1 > contrast2 ? color1 : color2;
}




/**
 * Determines whether to use light or dark text based on background color.
 * @param backgroundColor - The background color in hex or rgba format.
 * @returns "light" or "dark" indicating the recommended text color.
 */
function getTextColorForBackground(backgroundColor: string): "light" | "dark" {
  const rgb = parseColor(backgroundColor);
  if (!rgb) {
    console.error("Invalid color:", backgroundColor);
    return "light"; // default to light if invalid color
  }

  // Using threshold of 0.5 for better light/dark text discrimination
  const luminance = calculateLuminance(rgb[0], rgb[1], rgb[2]);
  return luminance > 0.5 ? "dark" : "light";
}




/**
 * Generates an alpha-modified version of a color
 * @param color - The color to modify (hex or rgba)
 * @param alpha - Alpha value between 0 and 1
 * @returns rgba color string with the specified alpha
 */
function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) {
    console.error("Invalid color for alpha:", color);
    return `rgba(0, 0, 0, ${alpha})`;
  }

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}


/**
 * Style factory context passed to the createStyles callback
 */
interface StyleContext {
  theme: Colors["light" | "dark"];
  spacing: typeof spacingConstants;
  withAlpha: (color: string, alpha: number) => string;
}

/**
 * Return type for useStyles hook
 */
type UseStylesReturn<T extends StyleSheet.NamedStyles<T>> = {
  styles: T;
  theme: Colors["light" | "dark"];
  spacing: typeof spacingConstants;
} & Omit<ReturnType<typeof useTheme>, "theme">;

/**
 * useStyles
 *
 * A hook that combines useTheme with StyleSheet.create for theme-aware styling.
 * Provides access to theme colors, spacing constants, and color helpers within the style factory.
 *
 * @param factory - A function that receives { theme, spacing, withAlpha } and returns style definitions
 * @returns { styles, theme, spacing, ...themeUtilities }
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { styles, theme } = useStyles(({ theme, spacing, withAlpha }) => ({
 *     container: {
 *       backgroundColor: withAlpha(theme.colors.primary, 0.08),
 *       padding: spacing.md,
 *       borderRadius: spacing.radiusMd,
 *     },
 *     text: {
 *       color: theme.colors.text,
 *       fontSize: 16,
 *     },
 *   }));
 *
 *   return (
 *     <View style={styles.container}>
 *       <Text style={styles.text}>Hello</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (context: StyleContext) => T
): UseStylesReturn<T> {
  const themeContext = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create(
        factory({
          theme: themeContext.theme,
          spacing: spacingConstants,
          withAlpha: themeContext.withAlpha,
        })
      ),
    [factory, themeContext.theme, themeContext.withAlpha]
  );

  return useMemo(() => ({
    styles,
    theme: themeContext.theme,
    spacing: spacingConstants,
    scheme: themeContext.scheme,
    getShadowStyle: themeContext.getShadowStyle,
    getFocusRingStyle: themeContext.getFocusRingStyle,
    getContrastingColor: themeContext.getContrastingColor,
    getTextColorForBackground: themeContext.getTextColorForBackground,
    withAlpha: themeContext.withAlpha,
    getContrastRatio: themeContext.getContrastRatio,
    toggleTheme: themeContext.toggleTheme,
    setTheme: themeContext.setTheme,
    currentTheme: themeContext.currentTheme,
  }), [styles, themeContext]);
}
