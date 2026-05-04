import { palette } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";
import { spacing } from "../constants/spacing";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";
import * as SwitchPrimitives from "@rn-primitives/switch";
import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  useReducedMotion,
} from "react-native-reanimated";
import { StyledText } from "./StyledText";

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

  // Single shared value drives everything: 0 = off, 1 = on
  const progress = useSharedValue(props.checked ? 1 : 0);

  useEffect(() => {
    const target = props.checked ? 1 : 0;
    if (reduceMotion) {
      progress.value = withTiming(target, { duration: 0 });
    } else {
      progress.value = withTiming(target, { duration: 120 });
    }
  }, [props.checked, reduceMotion]);

  // Thumb slides from left to right
  const thumbOffset = 2;
  const thumbEnd = size.width - thumbSize - thumbOffset;

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [thumbOffset, thumbEnd]) },
    ],
  }));

  const isIOS = variant === "ios";
  // Keep the default checked state on a stable dark neutral so the white thumb
  // stays distinct in both light and dark themes.
  const checkedColor = isIOS ? "#34C759" : theme.colors.primary;
  const uncheckedColor = theme.dark ? withAlpha(palette.white, 0.18) : theme.colors.input;
  const trackBg = props.checked ? checkedColor : uncheckedColor;
  const trackBorderColor = props.checked
    ? theme.dark
      ? withAlpha(palette.white, 0.18)
      : withAlpha(palette.black, 0.08)
    : theme.dark
      ? withAlpha(palette.white, 0.14)
      : palette.gray300;
  const thumbBorderColor = theme.dark
    ? withAlpha(palette.black, 0.24)
    : withAlpha(palette.black, 0.12);
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
          ...StyleSheet.absoluteFillObject,
          borderRadius: size.height / 2,
          backgroundColor: trackBg,
          borderWidth: 1,
          borderColor: trackBorderColor,
        }}
        pointerEvents="none"
      />

      {/* Label ON */}
      {labelOn && !isIOS && (
        <View
          style={{
            position: "absolute",
            left: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: props.checked ? 1 : 0,
          }}
          pointerEvents="none"
        >
          <StyledText
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
              borderRadius: thumbSize / 2,
              backgroundColor: palette.white,
              borderWidth: 1,
              borderColor: thumbBorderColor,
              justifyContent: "center",
              alignItems: "center",
              ...getShadowStyle("sharp"),
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
            position: "absolute",
            right: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: props.checked ? 0 : 1,
          }}
          pointerEvents="none"
        >
          <StyledText
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

export { Switch };
