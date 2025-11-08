import React, { forwardRef } from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/constants/fonts";

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
 * Font size variants following a consistent scale
 */
export type FontSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

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
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

const SEMANTIC_CONFIGS: Record<SemanticVariant, { size: FontSize; weight: "regular" | "bold" }> = {
  title: { size: "4xl", weight: "bold" },
  heading: { size: "2xl", weight: "bold" },
  subheading: { size: "xl", weight: "bold" },
  body: { size: "md", weight: "regular" },
  caption: { size: "sm", weight: "regular" },
  label: { size: "sm", weight: "bold" },
};

// Map font weights to actual font family variants (we only have regular and bold)
const getFontFamilyWeight = (weight?: FontWeight): "regular" | "bold" => {
  if (!weight || weight === "light" || weight === "regular") return "regular";
  return "bold"; // medium, semibold, bold all map to bold
};

export type TextProps = RNTextProps & {
  /**
   * Font variant - serif or sans-serif
   */
  variant?: "serif" | "sansSerif";
  /**
   * Font weight - regular or bold (light, medium, semibold map to closest available)
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
 * Uses theme colors automatically - textPrimary by default
 *
 * New features:
 * - Size variants (xs, sm, md, lg, xl, 2xl, 3xl, 4xl)
 * - Semantic variants (title, heading, subheading, body, caption, label)
 * - Text alignment prop
 * - Font weight options
 * - Text selection enabled by default (userSelect: "auto")
 * - numberOfLines and ellipsizeMode support from RN TextProps
 */
export const Text = forwardRef<RNText, TextProps>((props, ref) => {
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

  // Check if there's a color override from parent context (e.g., Button)
  const contextColor = React.useContext(TextColorContext);

  // Use context color if provided, otherwise use theme default
  const color = contextColor ?? theme.colors.textPrimary;

  // If semantic variant is provided, use its config
  const semanticConfig = semantic ? SEMANTIC_CONFIGS[semantic] : undefined;
  const finalSize = semanticConfig?.size ?? size ?? "md";
  const finalFontWeight = semanticConfig?.weight ?? fontWeight ?? "regular";

  // Get font family based on variant and weight
  const fontFamilyWeight = getFontFamilyWeight(finalFontWeight);
  const fontFamily = fontFamilies[variant][fontFamilyWeight];

  // Get fontSize from size variant
  const fontSize = FONT_SIZES[finalSize];

  // Simple i18n placeholder - in a real app, this would use a proper i18n library
  const i18nText = tx ? tx : text;
  const content = i18nText || children;

  return (
    <RNText
      ref={ref}
      style={[
        {
          color,
          fontFamily,
          fontSize,
          userSelect: "auto", // Changed from "none" to allow text selection
          ...(align && { textAlign: align }),
        },
        style,
      ]}
      {...otherProps}
    >
      {content}
    </RNText>
  );
});

Text.displayName = "Text";

/**
 * Serif Text Component
 * Uses serif font family (Merriweather)
 */
export function SerifText(props: TextProps) {
  return <Text {...props} variant="serif" />;
}

/**
 * Sans-Serif Text Component
 * Uses sans-serif font family (Lato)
 */
export function SansSerifText(props: TextProps) {
  return <Text {...props} variant="sansSerif" />;
}

/**
 * Serif Bold Text Component
 * Uses serif font family with bold weight
 */
export function SerifBoldText(props: TextProps) {
  return <Text {...props} variant="serif" fontWeight="bold" />;
}

/**
 * Sans-Serif Bold Text Component
 * Uses sans-serif font family with bold weight
 */
export function SansSerifBoldText(props: TextProps) {
  return <Text {...props} variant="sansSerif" fontWeight="bold" />;
}

// Export convenience components for semantic variants

/**
 * Title Text - Extra large bold text for page titles
 */
export function TitleText(props: TextProps) {
  return <Text {...props} semantic="title" />;
}

/**
 * Heading Text - Large bold text for section headings
 */
export function HeadingText(props: TextProps) {
  return <Text {...props} semantic="heading" />;
}

/**
 * Subheading Text - Medium-large bold text for subsections
 */
export function SubheadingText(props: TextProps) {
  return <Text {...props} semantic="subheading" />;
}

/**
 * Body Text - Default text for paragraphs and content
 */
export function BodyText(props: TextProps) {
  return <Text {...props} semantic="body" />;
}

/**
 * Caption Text - Small text for captions and secondary content
 */
export function CaptionText(props: TextProps) {
  return <Text {...props} semantic="caption" />;
}

/**
 * Label Text - Small bold text for form labels
 */
export function LabelText(props: TextProps) {
  return <Text {...props} semantic="label" />;
}
