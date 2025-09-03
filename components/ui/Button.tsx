import React, { ReactNode, useRef } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
  PressableProps,
  Animated,
  Platform,
  ColorValue
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

type Props = PressableProps & {
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  withShadow?: boolean;
  variant?: "default" | "outline" | "primary";
};

export const Button = ({
  children,
  style,
  onPress,
  disabled = false,
  withShadow = true,
  variant = "default",
  ...props
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

  // Determine background and border colors based on variant
  let backgroundColor: ColorValue = theme.colors.primary;
  let borderProps = {};
  
  if (variant === "outline") {
    backgroundColor = "transparent";
    borderProps = {
      borderWidth: 1,
      borderColor: theme.colors.primary,
    };
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
      {...props}
    >
      <Animated.View style={[styles.contentContainer, { opacity: animated }]}>
        {children}
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
  disabled: {
    opacity: 0.6,
  },
});
