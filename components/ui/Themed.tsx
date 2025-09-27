import React, { forwardRef } from "react";
import {
  Text as DefaultText,
  View as DefaultView,
  StyleSheet,
  ScrollViewProps as DefaultScrollViewProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { colors, Theme } from "@/constants/colors";
import { fontFamilies } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"] & {
  variant?: "serif" | "sansSerif";
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

export type ViewProps = ThemeProps & DefaultView["props"];

export type ScrollViewProps = ThemeProps & DefaultScrollViewProps & {
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof Theme["colors"]
) {
  const { scheme } = useTheme();
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[scheme].colors[colorName] as string;
  }
}

export const Text = forwardRef<DefaultText, TextProps>((props, ref) => {
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
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const fontFamily = fontFamilies[variant][fontWeight];

  // Simple i18n placeholder - in a real app, this would use a proper i18n library
  const i18nText = tx ? tx : text;
  const content = i18nText || children;

  return <DefaultText ref={ref} style={[styles.defaultText, { color, fontFamily }, style]} {...otherProps}>
    {content}
  </DefaultText>;
});
Text.displayName = "Text";

export const View = forwardRef<DefaultView, ViewProps>((props, ref) => {
  const { style, lightColor, darkColor, ...otherProps } = props;
  // const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, "background");

  return <DefaultView ref={ref} style={[styles.defaultView, style]} {...otherProps} />;
});
View.displayName = "View";

const styles = StyleSheet.create({
  defaultView: {
    backgroundColor: "transparent",
  },
  defaultText: {
    userSelect: "none",
  },
  scrollView: {
    flexGrow: 1,
    height: "100%",
    width: "100%",
  },
  scrollViewContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
