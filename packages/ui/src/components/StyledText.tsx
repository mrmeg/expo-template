import { use, type Ref } from "react";
import { Platform, Text as RNText, TextProps as RNTextProps, StyleProp, StyleSheet, TextStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fontFamilies } from "../constants/fonts";
import { translateText } from "../lib/i18n";
import { TextColorContext, TextSelectabilityContext, TextStyleContext } from "./StyledText.context";

/**
 * Font size variants for the type scale (Inter sans-serif / Georgia serif)
 */
export type FontSize = "xs" | "sm" | "base" | "body" | "lg" | "xl" | "xxl" | "display";

/**
 * Semantic text variants for different use cases
 */
export type SemanticVariant = "title" | "heading" | "subheading" | "body" | "caption" | "label" | "eyebrow";

/**
 * Font weight options
 */
export type FontWeight = "light" | "regular" | "medium" | "semibold" | "bold";

/**
 * Text alignment options
 */
export type TextAlign = "left" | "center" | "right" | "justify" | "auto";

const FONT_SIZES: Record<FontSize, number> = {
  xs: 11,
  sm: 12,
  base: 14,
  body: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
};

const LINE_HEIGHTS: Record<FontSize, number> = {
  xs: 16.5,
  sm: 18,
  base: 21,
  body: 24.75,
  lg: 27,
  xl: 26.4,
  xxl: 33.6,
  display: 40.8,
};

// Per-size tracking (px), derived from em targets (em × fontSize, rounded to
// 2 decimals): tight tracking on large headings, neutral through body text,
// positive tracking on small/micro labels so they don't read cramped at size.
// RN's `letterSpacing` is px, not em, hence the pre-multiplied values here.
const LETTER_SPACING: Record<FontSize, number> = {
  xs: 0.11,     // +0.01em × 11
  sm: 0.06,     // +0.005em × 12
  base: 0,
  body: 0,
  lg: -0.09,    // -0.005em × 18
  xl: -0.22,    // -0.01em × 22
  xxl: -0.42,   // -0.015em × 28
  display: -0.68, // -0.02em × 34
};

// Eyebrow/overline tracking is deliberately wider than the "sm" default
// above — it's a distinct uppercase-label treatment, not the same tracking
// used for ordinary small text at that size. +0.08em × 12px (sm fontSize).
const EYEBROW_LETTER_SPACING = 0.96;

const SEMANTIC_CONFIGS: Record<SemanticVariant, { size: FontSize; weight: FontWeight }> = {
  title: { size: "xxl", weight: "semibold" },
  heading: { size: "xl", weight: "semibold" },
  subheading: { size: "lg", weight: "medium" },
  body: { size: "body", weight: "regular" },
  caption: { size: "sm", weight: "regular" },
  label: { size: "base", weight: "medium" },
  // Section-label idiom (uppercase, widely tracked) — see EYEBROW_LETTER_SPACING
  // and the textTransform applied in StyledText below.
  eyebrow: { size: "sm", weight: "semibold" },
};

// Font family weight keys now map 1:1 onto FontWeight — every weight has a
// real family entry (native: a distinct static Inter file; web: shared
// "Inter" family + numeric fontWeight, see WEB_FONT_WEIGHTS). Defaults to
// "regular" when no weight is requested.
const getFontFamilyWeight = (weight?: FontWeight): FontWeight => weight ?? "regular";

// Web-only: the numeric fontWeight that picks the right @font-face variant
// out of the single shared "Inter" CSS family. "light" has no loaded 300
// weight (mirrors the native light->regular mapping in constants/fonts.ts),
// so it renders at 400 like "regular".
const WEB_FONT_WEIGHTS: Record<FontWeight, NonNullable<TextStyle["fontWeight"]>> = {
  light: "400",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export type TextProps = RNTextProps & {
  /**
   * Font variant - serif (Georgia) or sans-serif (Inter)
   */
  variant?: "serif" | "sansSerif";
  /**
   * Font weight - light, regular, medium, semibold, bold
   */
  fontWeight?: FontWeight;
  /**
   * Font size variant
   */
  size?: FontSize;
  /**
   * Semantic variant - automatically sets size and weight
   * Overrides individual size/fontWeight if provided
   */
  semantic?: SemanticVariant;
  /**
   * Text alignment
   */
  align?: TextAlign;
  /**
   * Text which is looked up via i18n.
   */
  tx?: string;
  /**
   * The text to display directly, or as fallback text when `tx` is provided.
   */
  text?: string;
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: object;
  /**
   * Forwarded ref to the underlying RNText element.
   */
  ref?: Ref<RNText>;
};

/**
 * Base Text component with theme and variant support
 * Uses theme colors automatically - text by default
 *
 * Features:
 * - Size variants (xs, sm, base, body, lg, xl, xxl, display)
 * - Semantic variants (title, heading, subheading, body, caption, label, eyebrow)
 * - Text alignment prop
 * - Font weight options (light, regular, medium, semibold, bold) — resolves to
 *   real Inter font files on native, and family + numeric fontWeight on web
 * - Per-size letter-spacing scale (tight on large headings, positive on micro
 *   labels); explicit `style` letterSpacing always wins
 * - Text selection enabled by default; pass `selectable={false}` for control
 *   chrome such as button labels, tabs, badges, and field labels
 * - numberOfLines and ellipsizeMode support from RN TextProps
 */
export function StyledText(props: TextProps) {
  const {
    tx,
    text,
    txOptions,
    style,
    variant = "sansSerif",
    fontWeight,
    size,
    semantic,
    align,
    selectable,
    children,
    ref,
    ...otherProps
  } = props;

  const { theme } = useTheme();

  // Check if there's a color override from parent context (e.g., Button)
  const contextColor = use(TextColorContext);
  const contextTextStyle = use(TextStyleContext);
  const contextSelectable = use(TextSelectabilityContext);
  const resolvedSelectable = selectable ?? contextSelectable ?? true;

  // Use context color if provided, otherwise use theme default
  const color = contextColor ?? theme.colors.text;

  // If semantic variant is provided, use its config
  const semanticConfig = semantic ? SEMANTIC_CONFIGS[semantic] : undefined;
  const finalSize = semanticConfig?.size ?? size ?? "body";
  const finalFontWeight = semanticConfig?.weight ?? fontWeight ?? "regular";

  // Get font family based on variant and weight
  const fontFamilyWeight = getFontFamilyWeight(finalFontWeight);
  // Georgia (serif) only has one weight — use it regardless of requested weight
  const fontFamily = variant === "serif"
    ? fontFamilies.serif.regular
    : fontFamilies.sansSerif[fontFamilyWeight] ?? fontFamilies.sansSerif.regular;

  // Web ships one Inter family for every weight, so a numeric fontWeight picks
  // the right @font-face variant. Native ships a discrete static font file per
  // weight (see constants/fonts.ts) — the family name alone carries the
  // weight there, and adding a numeric fontWeight on top would faux-bold an
  // already-bold file, so this stays web-only.
  const resolvedFontWeight = Platform.OS === "web" ? WEB_FONT_WEIGHTS[finalFontWeight] : undefined;

  // Get fontSize and lineHeight from size variant
  const fontSize = FONT_SIZES[finalSize];
  const lineHeight = LINE_HEIGHTS[finalSize];
  const letterSpacing = semantic === "eyebrow" ? EYEBROW_LETTER_SPACING : LETTER_SPACING[finalSize];

  // If style overrides fontSize without lineHeight, drop the preset lineHeight
  // so RN uses its default (avoids clipping text with a mismatched lineHeight)
  const flatStyle = style ? StyleSheet.flatten(style as any) : undefined;
  const styleHasFontSize = flatStyle && "fontSize" in flatStyle;
  const styleHasLineHeight = flatStyle && "lineHeight" in flatStyle;
  const resolvedLineHeight = styleHasFontSize && !styleHasLineHeight ? undefined : lineHeight;
  const flattenedContextTextStyle = contextTextStyle
    ? StyleSheet.flatten(contextTextStyle)
    : undefined;
  const resolvedContextTextStyle =
    flattenedContextTextStyle && styleHasFontSize && !styleHasLineHeight
      ? { ...flattenedContextTextStyle, lineHeight: undefined }
      : contextTextStyle;

  const i18nText = translateText(tx, text, txOptions);
  const content = i18nText || children;

  return (
    <RNText
      ref={ref}
      style={[
        {
          color,
          fontFamily,
          fontSize,
          ...(resolvedFontWeight !== undefined && { fontWeight: resolvedFontWeight }),
          ...(resolvedLineHeight !== undefined && { lineHeight: resolvedLineHeight }),
          userSelect: resolvedSelectable ? "auto" : "none",
          ...(letterSpacing !== undefined && { letterSpacing }),
          ...(align && { textAlign: align }),
          ...(semantic === "eyebrow" && { textTransform: "uppercase" }),
        },
        resolvedContextTextStyle,
        style,
      ]}
      selectable={resolvedSelectable}
      {...otherProps}
    >
      {content}
    </RNText>
  );
}

/**
 * Serif Text Component
 * Uses the serif font family (Georgia)
 */
export function SerifText(props: TextProps) {
  return <StyledText {...props} variant="serif" />;
}

/**
 * Sans-Serif Text Component
 * Uses the sans-serif font family (Inter)
 */
export function SansSerifText(props: TextProps) {
  return <StyledText {...props} variant="sansSerif" />;
}

/**
 * Serif Bold Text Component
 * Uses the serif font family — Georgia's only shipped weight is regular
 */
export function SerifBoldText(props: TextProps) {
  return <StyledText {...props} variant="serif" fontWeight="regular" />;
}

/**
 * Sans-Serif Bold Text Component
 * Uses the sans-serif font family at semibold weight (Inter 600)
 */
export function SansSerifBoldText(props: TextProps) {
  return <StyledText {...props} variant="sansSerif" fontWeight="semibold" />;
}

/**
 * Display Text Component
 * Uses the serif font family (Georgia) at display size — for hero text and
 * splash screens
 */
export function DisplayText(props: TextProps) {
  return <StyledText {...props} variant="serif" size="display" />;
}

// Export convenience components for semantic variants

/**
 * Title Text - Large semibold text for page titles
 */
export function TitleText(props: TextProps) {
  return <StyledText {...props} semantic="title" />;
}

/**
 * Heading Text - Section heading text
 */
export function HeadingText(props: TextProps) {
  return <StyledText {...props} semantic="heading" />;
}

/**
 * Subheading Text - Subsection heading text
 */
export function SubheadingText(props: TextProps) {
  return <StyledText {...props} semantic="subheading" />;
}

/**
 * Body Text - Default text for paragraphs and content
 */
export function BodyText(props: TextProps) {
  return <StyledText {...props} semantic="body" />;
}

/**
 * Caption Text - Small text for captions and secondary content
 */
export function CaptionText(props: TextProps) {
  return <StyledText {...props} semantic="caption" />;
}

/**
 * Label Text - Medium weight text for form labels
 */
export function LabelText(props: TextProps) {
  return <StyledText {...props} semantic="label" />;
}

/**
 * Eyebrow Text - Small, semibold, uppercase section label with wide positive
 * tracking (the overline idiom above a heading). Consumed by the SectionHeader
 * primitive (separate spec).
 */
export function EyebrowText(props: TextProps) {
  return <StyledText {...props} semantic="eyebrow" />;
}
