import React, { forwardRef } from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/constants/fonts";

/**
 * TextColorContext provides color context for nested text components
 * Allows parent components (like Button) to override text color for all children
 */
export const TextColorContext = React.createContext<string | undefined>(undefined);

export type TextProps = RNTextProps & {
  /**
   * Font variant - serif or sans-serif
   */
  variant?: "serif" | "sansSerif";
  /**
   * Font weight - regular or bold
   */
  fontWeight?: "regular" | "bold";
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
 * Uses theme colors automatically - lightText in light mode, darkText in dark mode
 */
export const Text = forwardRef<RNText, TextProps>((props, ref) => {
  const {
    tx,
    text,
    txOptions,
    style,
    variant = "sansSerif",
    fontWeight = "regular",
    children,
    ...otherProps
  } = props;

  const { theme } = useTheme();

  // Check if there's a color override from parent context (e.g., Button)
  const contextColor = React.useContext(TextColorContext);

  // Use context color if provided, otherwise use theme default
  const color = contextColor ?? theme.colors["base-content"];

  // Get font family based on variant and weight
  const fontFamily = fontFamilies[variant][fontWeight];

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
          userSelect: "none",
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
