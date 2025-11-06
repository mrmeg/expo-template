import { Colors, colors } from "@/constants/colors";
import { useColorScheme as useColorSchemeDefault, ViewStyle, Platform } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

type ShadowType = 'base' | 'soft' | 'sharp' | 'subtle';

interface ExtendedColorScheme {
  base: Colors["base"];
  theme: Colors["light" | "dark"];
  scheme: "light" | "dark";
  // Shadow helper function
  getShadowStyle: (type: ShadowType) => ViewStyle;
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
 * - base: shared base colors
 * - theme: active theme colors (light or dark)
 * - scheme: "light" | "dark"
 * - getShadowStyle(type): returns cross-platform shadow style object
 * - getContrastingColor(bg, color1?, color2?): pick best contrast of two options
 * - getTextColorForBackground(bg): returns "light" or "dark"
 * - withAlpha(color, alpha): adds transparency
 * - getContrastRatio(color1, color2): returns numeric WCAG contrast ratio
 *
 * Examples:
 * - getTextColorForBackground("#000") → "light"
 * - getContrastingColor("#f4f4f4", "#222", "#fff") → "#222"
 * - withAlpha("#336699", 0.6) → "rgba(51,102,153,0.6)"
 * - getShadowStyle('base') → { shadowColor, shadowOffset, ... }
 */
export function useTheme(): ExtendedColorScheme & {
  toggleTheme: () => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  currentTheme: "system" | "light" | "dark";
} {
  const { userTheme, setTheme } = useThemeStore();
  let defaultScheme = useColorSchemeDefault();

  // Ensure a scheme is selected, even if we fail to get one
  if (!defaultScheme) {
    defaultScheme = "light";
  }

  // Determine which theme to use (user preference or system)
  const effectiveScheme = userTheme === "system" ? defaultScheme : userTheme;
  const theme = colors[effectiveScheme];

  // Toggle between light, dark, and system themes
  const toggleTheme = () => {
    if (userTheme === "system") {
      setTheme("light");
    } else if (userTheme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  };

  /**
   * getShadowStyle
   * Returns platform-appropriate shadow styles
   * - Web: returns empty object (boxShadow not supported by RN Web)
   * - Native: uses shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation
   */
  const getShadowStyle = (type: ShadowType): ViewStyle => {
    const shadowConfigs = {
      base: {
        shadowColor: theme.colors.overlay,
        shadowOffset: { width: 2, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
      },
      soft: {
        shadowColor: theme.colors.overlay,
        shadowOffset: { width: 2, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 12,
      },
      sharp: {
        shadowColor: theme.colors.overlay,
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 5,
      },
      subtle: {
        shadowColor: theme.colors.overlay,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    };

    const config = shadowConfigs[type];

    return Platform.select({
      web: {} as ViewStyle, // Empty on web - boxShadow causes crashes
      default: config,
    }) as ViewStyle;
  };

  // Cache for contrast calculations to avoid redundant computation
  // React 19 compiler handles component-level memoization, but this cache
  // optimizes across components and re-renders
  const contrastCache = new Map<string, string>();

  // Helper to calculate contrast ratio between two colors
  const getContrastRatio = (color1: string, color2: string): number => {
    const rgb1 = parseColor(color1);
    const rgb2 = parseColor(color2);

    if (!rgb1 || !rgb2) {
      console.error("Invalid colors for contrast ratio:", color1, color2);
      return 1; // Default to minimum contrast
    }

    const lum1 = calculateLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = calculateLuminance(rgb2[0], rgb2[1], rgb2[2]);

    return calculateContrastRatio(lum1, lum2);
  };

  // Cached version of getContrastingColor for performance
  const getCachedContrastingColor = (
    backgroundColor: string,
    color1?: string,
    color2?: string
  ): string => {
    const cacheKey = `${backgroundColor}-${color1}-${color2}`;

    if (contrastCache.has(cacheKey)) {
      return contrastCache.get(cacheKey)!;
    }

    const result = getBetterContrast(backgroundColor, color1, color2);
    contrastCache.set(cacheKey, result);
    return result;
  };

  const colorScheme: ExtendedColorScheme & {
    toggleTheme: () => void;
    setTheme: (theme: "system" | "light" | "dark") => void;
    currentTheme: "system" | "light" | "dark";
  } = {
    base: colors.base,
    theme: theme,
    scheme: theme.dark ? "dark" : "light",
    // Shadow helper function
    getShadowStyle,
    // Theme switching methods
    toggleTheme,
    setTheme,
    currentTheme: userTheme,
    // Color utility methods (using cached version for performance)
    getContrastingColor: getCachedContrastingColor,
    getTextColorForBackground: (backgroundColor: string) =>
      getTextColorForBackground(backgroundColor),
    withAlpha: (color: string, alpha: number) =>
      withAlpha(color, alpha),
    getContrastRatio: (color1: string, color2: string) =>
      getContrastRatio(color1, color2)
  };

  return colorScheme;
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
