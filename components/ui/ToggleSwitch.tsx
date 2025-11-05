import React, { useRef, useEffect } from "react";
import { Animated, StyleSheet, TextStyle, Pressable } from "react-native";
import { SansSerifBoldText } from "./StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

type Props = {
  // Standard React Native Switch API
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  // Legacy API (for backwards compatibility)
  enabled?: boolean;
  setEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  // Customization
  size?: { width: number; height: number };
  circleSize?: number;
  labelOn?: string;
  labelOff?: string;
  marginHorizontal?: number;
};

const BORDER_WIDTH = 0;

export const ToggleSwitch = ({
  value,
  onValueChange,
  enabled,
  setEnabled,
  size = { width: 100, height: 32 },
  circleSize = 30,
  labelOn = "",
  labelOff = "",
  marginHorizontal = 2, // Default horizontal margin for the circle
}: Props) => {
  const { base, theme } = useTheme();
  const styles = createStyles(theme, base);

  // Support both value/onValueChange (standard) and enabled/setEnabled (legacy)
  const isEnabled = value !== undefined ? value : enabled ?? false;
  const handleChange = onValueChange || ((val: boolean) => setEnabled?.(val));

  const animatedValue = useRef(new Animated.Value(isEnabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isEnabled ? 1 : 0,
      duration: 150,
      useNativeDriver: false  // Changed to `true` to improve performance
    }).start();
  }, [isEnabled]);

  const toggleSwitch = () => {
    handleChange(!isEnabled);
  };

  const marginLeft = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [marginHorizontal, size.width - circleSize - marginHorizontal],
  });

  const labelStyle: TextStyle = {
    userSelect: "none",
    position: "absolute",
    fontSize: size.height / 3,
    color: base.white,
  };

  return (
    <Pressable onPress={toggleSwitch}>
      <Animated.View style={[styles.container, {
        backgroundColor: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [base.inactive, base.success],
        }),
        borderColor: theme.colors["base-300"],
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        padding: BORDER_WIDTH,
      }]}>
        <SansSerifBoldText style={[labelStyle, { left: spacing.sm + 2 }]}>{isEnabled ? labelOn : ""}</SansSerifBoldText>
        <Animated.View style={[styles.circle, {
          backgroundColor: base.white,
          borderColor: theme.colors["base-300"],
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          marginLeft
        }]} />
        <SansSerifBoldText style={[labelStyle, { right: spacing.sm + 2, color: base["base-content"] }]}>{!isEnabled ? labelOff : ""}</SansSerifBoldText>
      </Animated.View>
    </Pressable>
  );
};

const createStyles = (theme: any, base: any) => StyleSheet.create({
  container: {
    justifyContent: "center",
    borderWidth: BORDER_WIDTH,
  },
  circle: {
    borderWidth: 1,
  },
});
