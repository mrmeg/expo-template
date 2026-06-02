import { palette } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";
import { spacing } from "../constants/spacing";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";
import * as SwitchPrimitives from "@rn-primitives/switch";
import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleProp, StyleSheet, View, ViewStyle, Animated } from "react-native";
import { StyledText } from "./StyledText";
import { useReducedMotion } from "../hooks/useReduceMotion";

const DEFAULT_HIT_SLOP = 8;

/**
 * Switch variant styles
 */
export type SwitchVariant = "default" | "ios";

interface SwitchProps extends Omit<SwitchPrimitives.RootProps, "style"> {
  /**
   * Visual variant
   * @default "default"
   */
  variant?: SwitchVariant;
  /**
   * Optional label to display when switch is ON (checked)
   */
  labelOn?: string;
  /**
   * Optional label to display when switch is OFF (unchecked)
   */
  labelOff?: string;
  /**
   * Custom size for the switch container
   * Default: { width: 44, height: 24 }
   */
  size?: { width: number; height: number };
  /**
   * Custom size for the thumb (sliding circle)
   * Default: 20
   */
  thumbSize?: number;
  /**
   * Whether to show a loading spinner inside the thumb
   */
  loading?: boolean;
  /**
   * Custom style override (uses StyleSheet.flatten for web compatibility)
   */
  style?: StyleProp<ViewStyle>;
}

function Switch({
  variant = "default",
  labelOn,
  labelOff,
  size = { width: 44, height: 24 },
  thumbSize = 20,
  loading = false,
  style: styleOverride,
  ...props
}: SwitchProps) {
  const { theme, getContrastingColor, getShadowStyle, withAlpha } = useTheme();
  const reduceMotion = useReducedMotion();
  const hasMounted = useRef(false);

  // Fire haptic on user-initiated toggles (skip initial mount)
  const wrappedOnCheckedChange = useCallback(
    (checked: boolean) => {
      if (hasMounted.current) hapticLight();
      props.onCheckedChange?.(checked);
    },
    [props.onCheckedChange],
  );

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Single animated value drives everything: 0 = off, 1 = on
  const progress = useRef(new Animated.Value(props.checked ? 1 : 0)).current;

  useEffect(() => {
    const target = props.checked ? 1 : 0;
    Animated.timing(progress, {
      toValue: target,
      duration: reduceMotion ? 0 : 120,
      useNativeDriver: true,
    }).start();
  }, [props.checked, reduceMotion, progress]);

  // Thumb slides from left to right with equal inset on every side.
  const thumbInset = Math.max(2, (size.height - thumbSize) / 2);
  const thumbTravel = Math.max(0, size.width - thumbSize - thumbInset * 2);
  const labelGap = spacing.xs;
  const labelHorizontalInset = spacing.xs;

  const thumbAnimatedStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, thumbTravel],
        }),
      },
    ],
  };

  const isIOS = variant === "ios";
  const checkedColor = isIOS ? "#34C759" : theme.colors.accent;
  const uncheckedColor = theme.dark ? withAlpha(palette.white, 0.12) : theme.colors.input;
  const trackBg = props.checked ? checkedColor : uncheckedColor;
  const trackBorderColor = props.checked
    ? withAlpha(checkedColor, theme.dark ? 0.55 : 0.42)
    : theme.dark
      ? withAlpha(palette.white, 0.16)
      : palette.gray300;
  const thumbBackgroundColor = theme.dark ? palette.gray100 : palette.white;
  const thumbBorderColor = theme.dark
    ? withAlpha(palette.black, 0.36)
    : withAlpha(palette.black, 0.1);
  const thumbIndicatorColor = props.checked ? checkedColor : theme.colors.textDim;

  // Calculate label color for ON state
  const labelOnColor = getContrastingColor(
    checkedColor,
    palette.white,
    palette.black
  );

  const labelFontSize = size.height / 3;

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  return (
    <SwitchPrimitives.Root
      {...props}
      onCheckedChange={wrappedOnCheckedChange}
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        justifyContent: "center",
        opacity: props.disabled ? 0.5 : 1,
        ...(Platform.OS === "web" && { cursor: props.disabled ? "not-allowed" : ("pointer" as any) }),
        ...(flattenedStyle || {}),
      }}
      hitSlop={DEFAULT_HIT_SLOP}
      accessibilityRole="switch"
      accessibilityState={{
        checked: props.checked,
        disabled: !!props.disabled,
        busy: loading,
      }}
    >
      {/* Track background */}
      <View
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: size.height / 2,
          backgroundColor: trackBg,
          borderWidth: 1,
          borderColor: trackBorderColor,
          pointerEvents: "none",
        }}
      />

      {/* Label ON */}
      {labelOn && !isIOS && (
        <View
          style={{
            ...styles.label,
            left: labelHorizontalInset,
            right: thumbInset + thumbSize + labelGap,
            opacity: props.checked ? 1 : 0,
          }}
        >
          <StyledText
            selectable={false}
            style={{
              fontFamily: fontFamilies.sansSerif.bold,
              fontSize: labelFontSize,
              color: labelOnColor,
              userSelect: "none",
            }}
          >
            {labelOn}
          </StyledText>
        </View>
      )}

      {/* Thumb */}
      <SwitchPrimitives.Thumb>
        <Animated.View
          style={[
            {
              width: thumbSize,
              height: thumbSize,
              marginLeft: thumbInset,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbBackgroundColor,
              borderWidth: 1,
              borderColor: thumbBorderColor,
              justifyContent: "center",
              alignItems: "center",
              ...getShadowStyle("subtle"),
            },
            thumbAnimatedStyle,
          ]}
        >
          {loading && (
            <ActivityIndicator
              size="small"
              color={thumbIndicatorColor}
            />
          )}
        </Animated.View>
      </SwitchPrimitives.Thumb>

      {/* Label OFF */}
      {labelOff && !isIOS && (
        <View
          style={{
            ...styles.label,
            left: thumbInset + thumbSize + labelGap,
            right: labelHorizontalInset,
            opacity: props.checked ? 0 : 1,
          }}
        >
          <StyledText
            selectable={false}
            style={{
              fontFamily: fontFamilies.sansSerif.bold,
              fontSize: labelFontSize,
              color: theme.colors.text,
              userSelect: "none",
            }}
          >
            {labelOff}
          </StyledText>
        </View>
      )}
    </SwitchPrimitives.Root>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
});

export { Switch };
