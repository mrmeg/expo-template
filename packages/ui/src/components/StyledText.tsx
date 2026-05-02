import React, { forwardRef } from "react";
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";
import { fontFamilies } from "../constants/fonts";

/**
 * TextClassContext provides className context for nested text components
 * Used by @rn-primitives to apply consistent styling through the component tree
 */
export const TextClassContext = React.createContext<string | undefined>(undefined);

/**
 * TextColorContext provides color context for nested text components
 * Allows parent components (like Button) to override text color for all children
 */
export const TextColorContext = React.createContext<string | undefined>(undefined);

/**
 * Font size variants following the DM Sans / DM Serif Display scale
 */
export type FontSize = "xs" | "sm" | "base" | "body" | "lg" | "xl" | "xxl" | "display";

/**
 * Semantic text variants for different use cases
 */
export type SemanticVariant = "title" | "heading" | "subheading" | "body" | "caption" | "label";

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

const LETTER_SPACING: Partial<Record<FontSize, number>> = {
  sm: 0.5,
  xxl: -0.3,
  display: -0.5,
};

const SEMANTIC_CONFIGS: Record<SemanticVariant, { size: FontSize; weight: FontWeight }> = {
  title: { size: "xxl", weight: "semibold" },
  heading: { size: "xl", weight: "semibold" },
  subheading: { size: "lg", weight: "medium" },
  body: { size: "body", weight: "regular" },
  caption: { size: "sm", weight: "regular" },
  label: { size: "base", weight: "medium" },
};

// Map font weights to actual font family weight keys
// DM Sans has: light, regular, medium, semibold
// DM Serif Display has: regular only
const getFontFamilyWeight = (weight?: FontWeight): "light" | "regular" | "medium" | "semibold" => {
  if (!weight || weight === "regular") return "regular";
  if (weight === "light") return "light";
  if (weight === "medium") return "medium";
  // semibold and bold both map to semibold (DM Sans's heaviest weight)
  return "semibold";
};

export type TextProps = RNTextProps & {
  /**
   * Font variant - serif (DM Serif Display) or sans-serif (DM Sans)
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
   * The text to display if not using `tx` or nested components.
   */
  text?: string;
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: object;
};

/**
 * Base Text component with theme and variant support
 * Uses theme colors automatically - text by default
 *
 * Features:
 * - Size variants (xs, sm, base, body, lg, xl, xxl, display)
 * - Semantic variants (title, heading, subheading, body, caption, label)
 * - Text alignment prop
 * - Font weight options (light, regular, medium, semibold, bold)
 * - Text selection enabled by default (userSelect: "auto")
 * - numberOfLines and ellipsizeMode support from RN TextProps
 */
export const StyledText = forwardRef<RNText, TextProps>((props, ref) => {
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
    children,
    ...otherProps
  } = props;

  const { theme } = useTheme();
  const { t } = useTranslation();

  // Check if there's a color override from parent context (e.g., Button)
  const contextColor = React.useContext(TextColorContext);

  // Use context color if provided, otherwise use theme default
  const color = contextColor ?? theme.colors.text;

  // If semantic variant is provided, use its config
  const semanticConfig = semantic ? SEMANTIC_CONFIGS[semantic] : undefined;
  const finalSize = semanticConfig?.size ?? size ?? "body";
  const finalFontWeight = semanticConfig?.weight ?? fontWeight ?? "regular";

  // Get font family based on variant and weight
  const fontFamilyWeight = getFontFamilyWeight(finalFontWeight);
  // DM Serif Display only has regular — use it regardless of requested weight
  const fontFamily = variant === "serif"
    ? fontFamilies.serif.regular
    : fontFamilies.sansSerif[fontFamilyWeight] ?? fontFamilies.sansSerif.regular;

  // Get fontSize and lineHeight from size variant
  const fontSize = FONT_SIZES[finalSize];
  const lineHeight = LINE_HEIGHTS[finalSize];
  const letterSpacing = LETTER_SPACING[finalSize];

  // If style overrides fontSize without lineHeight, drop the preset lineHeight
  // so RN uses its default (avoids clipping text with a mismatched lineHeight)
  const flatStyle = style ? StyleSheet.flatten(style as any) : undefined;
  const styleHasFontSize = flatStyle && "fontSize" in flatStyle;
  const styleHasLineHeight = flatStyle && "lineHeight" in flatStyle;
  const resolvedLineHeight = styleHasFontSize && !styleHasLineHeight ? undefined : lineHeight;

  const i18nText = tx ? String(t(tx, txOptions as any)) : text;
  const content = i18nText || children;

  return (
    <RNText
      ref={ref}
      style={[
        {
          color,
          fontFamily,
          fontSize,
          ...(resolvedLineHeight !== undefined && { lineHeight: resolvedLineHeight }),
          userSelect: "auto", // Changed from "none" to allow text selection
          ...(letterSpacing !== undefined && { letterSpacing }),
          ...(align && { textAlign: align }),
        },
        style,
        // When a parent (Button, ToggleGroupItem) sets TextColorContext,
        // that color must win over any color in the style prop
        contextColor != null && { color: contextColor },
      ]}
      {...otherProps}
    >
      {content}
    </RNText>
  );
});

StyledText.displayName = "StyledText";

/**
 * Serif Text Component
 * Uses serif font family (DM Serif Display)
 */
export function SerifText(props: TextProps) {
  return <StyledText {...props} variant="serif" />;
}

/**
 * Sans-Serif Text Component
 * Uses sans-serif font family (DM Sans)
 */
export function SansSerifText(props: TextProps) {
  return <StyledText {...props} variant="sansSerif" />;
}

/**
 * Serif Bold Text Component
 * Uses serif font family — DM Serif Display only has regular weight
 */
export function SerifBoldText(props: TextProps) {
  return <StyledText {...props} variant="serif" fontWeight="regular" />;
}

/**
 * Sans-Serif Bold Text Component
 * Uses sans-serif font family with semibold weight (DM Sans 600)
 */
export function SansSerifBoldText(props: TextProps) {
  return <StyledText {...props} variant="sansSerif" fontWeight="semibold" />;
}

/**
 * Display Text Component
 * Uses DM Serif Display at display size — for hero text and splash screens
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
