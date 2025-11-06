import React, { forwardRef } from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/constants/fonts";
import { Theme } from "@/constants/colors";

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

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & RNTextProps & {
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
 * Hook to get theme-aware colors with light/dark mode support
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof Theme["colors"]
) {
  const { theme, scheme } = useTheme();
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme.colors[colorName] as string;
  }
}

/**
 * Base Text component with theme, className, and variant support
 * Compatible with @rn-primitives and React Native Reusables patterns
 */
export const Text = forwardRef<RNText, TextProps>((props, ref) => {
  const {
    tx,
    text,
    txOptions,
    style,
    lightColor,
    darkColor,
    variant = "sansSerif",
    fontWeight = "regular",
    children,
    ...otherProps
  } = props;

  // Check if there's a color override from parent context (e.g., Button)
  const contextColor = React.useContext(TextColorContext);

  // Get themed color, prioritizing: explicit props > context > theme default
  const themeColor = useThemeColor({ light: lightColor, dark: darkColor }, "textPrimary");
  // If explicit color props are provided, use them; otherwise use context; fallback to theme
  const color = (lightColor || darkColor) ? themeColor : (contextColor || themeColor);

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
