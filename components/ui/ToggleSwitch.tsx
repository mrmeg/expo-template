import React, { useRef, useEffect } from "react";
import { Animated, StyleSheet, TextStyle, Pressable } from "react-native";
import { SansSerifBoldText } from "./StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

type Props = {
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  size?: { width: number; height: number };
  circleSize?: number;
  labelOn?: string;
  labelOff?: string;
  marginHorizontal?: number;
};

const BORDER_WIDTH = 0;

export const ToggleSwitch = ({
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
  const animatedValue = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: enabled ? 1 : 0,
      duration: 150,
      useNativeDriver: false  // Changed to `true` to improve performance
    }).start();
  }, [enabled]);

  const toggleSwitch = () => {
    setEnabled(!enabled);
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
        <SansSerifBoldText style={[labelStyle, { left: spacing.sm + 2 }]}>{enabled ? labelOn : ""}</SansSerifBoldText>
        <Animated.View style={[styles.circle, {
          backgroundColor: base.white,
          borderColor: theme.colors["base-300"],
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          marginLeft
        }]} />
        <SansSerifBoldText style={[labelStyle, { right: spacing.sm + 2, color: base["base-content"] }]}>{!enabled ? labelOff : ""}</SansSerifBoldText>
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
