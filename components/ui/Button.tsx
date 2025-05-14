import React, { ReactNode, useRef } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
  PressableProps,
  Animated,
  Platform,
  ColorValue
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
  
  // The animated value for the press animation
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

  // Determine background and text colors
  let backgroundColor: ColorValue = theme.colors.primary;
  let textColor: ColorValue = base.white;
  let borderProps = {};
  
  // Adjust styling based on variant
  if (variant === "outline") {
    backgroundColor = "transparent";
    textColor = theme.colors.primary;
    borderProps = {
      borderWidth: 1,
      borderColor: theme.colors.primary,
    };
  }
  
  // Check if custom text color was provided in titleStyle
  if (titleStyle) {
    const flattenedTitleStyle = StyleSheet.flatten(titleStyle);
    if (flattenedTitleStyle.color) {
      textColor = flattenedTitleStyle.color;
    }
  }

  // Get platform-specific styles
  const platformStyles = Platform.OS === "web" 
    ? styles.webButton 
    : Platform.OS === "ios" 
      ? styles.iosButton 
      : styles.androidButton;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      style={[
        styles.button,
        platformStyles,
        {
          backgroundColor,
          ...borderProps,
        },
        withShadow && themedStyles.baseShadow,
        style,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      android_ripple={Platform.OS === "android" ? { color: "rgba(255, 255, 255, 0.2)" } : undefined}
    >
      <Animated.View style={[styles.contentContainer, { opacity: animated }]}>
        {titleComponent ? (
          titleComponent
        ) : (
          <SansSerifText
            numberOfLines={2}
            ellipsizeMode='tail'
            style={[
              styles.title,
              {
                color: disabled ? base.gray[50] : textColor,
                fontSize: 16,
              },
              titleStyle,
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
  button: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  webButton: {
    // Web-specific styles
    cursor: "pointer",
  },
  iosButton: {
    // iOS-specific styles if needed
  },
  androidButton: {
    // Android-specific styles if needed
  },
  contentContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "500",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },
});
