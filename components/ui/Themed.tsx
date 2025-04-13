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
    style,
    lightColor,
    darkColor,
    variant = "sansSerif",
    fontWeight = "regular",
    ...otherProps
  } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const fontFamily = fontFamilies[variant][fontWeight];

  return <DefaultText ref={ref} style={[styles.defaultText, { color, fontFamily }, style]} {...otherProps} />;
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
