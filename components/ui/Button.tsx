import React, { ReactNode, useRef } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
  PressableProps,
  Animated
} from "react-native";
import { SansSerifText } from "./StyledText";
import { useTheme } from "@/hooks/useTheme";

type Props = PressableProps & {
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  titleComponent?: ReactNode;
  withShadow?: boolean;
  variant?: "default" | "outline" | "primary";
};

export const Button = ({
  title,
  titleComponent,
  titleStyle,
  style,
  onPress,
  disabled = false,
  withShadow = true,
  variant = "default",
}: Props) => {
  const { base, theme, themedStyles } = useTheme();
  const flattenedStyle = StyleSheet.flatten(style || {});
  const baseStyle: StyleProp<ViewStyle> = {
    borderRadius: flattenedStyle.borderRadius || 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  };

  const DEFAULT_TITLE_COLOR = base.white;

  const animated = useRef(new Animated.Value(1)).current;

  const fadeIn = () => {
    Animated.timing(animated, {
      toValue: 0.7,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const getButtonStyle = (): StyleProp<ViewStyle> => {
    if (variant === "outline") {
      return {
        ...baseStyle,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: theme.colors.primary,
      };
    }

    // Both "default" and "primary" variants use the primary color background
    return {
      ...baseStyle,
      backgroundColor: theme.colors.primary,
    };
  };

  const getTextColor = () => {
    // Check if a specific text color was provided in titleStyle
    // If it was, that color will be applied
    const customTextColor = titleStyle && StyleSheet.flatten(titleStyle).color;
    if (customTextColor) {
      return customTextColor;
    }

    // For outline buttons, use the primary color
    if (variant === "outline") {
      return theme.colors.primary;
    }

    /**
     * Text color defaults to white for dark mode and black for light mode
     *
     * If a custom background color is provided, the text color will be calculated
     * to ensure contract.
     */
    if (variant === "default") {
      // If custom background color is provided
      if (flattenedStyle.backgroundColor) {
        // For light backgrounds like white or very light gray, use dark text
        if (flattenedStyle.backgroundColor === DEFAULT_TITLE_COLOR ||
          flattenedStyle.backgroundColor === base.gray[50] ||
          flattenedStyle.backgroundColor === base.gray[100]) {
          return base.black;
        }
      }

      // Default text color for buttons
      return theme.dark ? base.black : base.white;
    }

    // For other variants, use appropriate text color based on theme
    return theme.dark ? base.white : base.black;
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      style={({ pressed }) => [
        getButtonStyle(),
        withShadow ? themedStyles.baseShadow : null,
        style,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
    >
      <Animated.View style={{ opacity: animated }}>
        {titleComponent ? (
          titleComponent
        ) : (
          <SansSerifText
            numberOfLines={2}
            ellipsizeMode='tail'
            style={[
              styles.title,
              {
                color: getTextColor(),
                fontSize: 16,
              },
              titleStyle, // This will override the color if specified in titleStyle
              disabled && { color: base.gray[400] },
            ]}
          >
            {title}
          </SansSerifText>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  title: {
    fontWeight: "500",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },
});
