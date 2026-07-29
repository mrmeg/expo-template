import {
  resolveFontStyle,
  type FontFamilyWeight,
  type FontVariant,
  type ResolvedFontStyle,
} from "../constants/fonts";
import { useThemeStore } from "../state/themeStore";

/**
 * Resolve a `{ fontFamily, fontWeight? }` style through the theme store's
 * font overrides, re-rendering when a host app calls `setFonts`.
 *
 * For control components (Button, Label, TextInput, …) whose typography is
 * a fixed weight rather than caller-driven. With no overrides set, the result
 * is identical to the package's hardcoded families, so layering it after a
 * static themed style changes nothing by default.
 */
export function useFontStyle(
  weight: FontFamilyWeight = "regular",
  variant: FontVariant = "sansSerif",
): ResolvedFontStyle {
  // Subscribed, not read via getState(), so a `setFonts` call after mount
  // re-renders instead of leaving stale families on screen.
  const fontOverrides = useThemeStore((s) => s.fontOverrides);
  return resolveFontStyle(fontOverrides, variant, weight);
}
