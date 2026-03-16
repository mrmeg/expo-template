import { palette } from "@/client/constants/colors";
import { fontFamilies } from "@/client/constants/fonts";
import { spacing } from "@/client/constants/spacing";
import { useTheme } from "@/client/hooks/useTheme";
import { hapticLight } from "@/client/lib/haptics";
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
  const { theme, getContrastingColor } = useTheme();
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
  const checkedColor = isIOS ? "#34C759" : theme.colors.primary;
  const uncheckedColor = theme.colors.muted;
  const trackBg = props.checked ? checkedColor : uncheckedColor;
  const trackBorder = props.checked ? checkedColor : theme.colors.border;

  // Calculate label color for ON state
  const labelOnColor = getContrastingColor(
    theme.colors.primary,
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
        ...(Platform.OS === "web" && { cursor: "pointer" as any }),
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
          borderWidth: 1,
          backgroundColor: trackBg,
          borderColor: trackBorder,
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
              borderColor: theme.colors.border,
              justifyContent: "center",
              alignItems: "center",
              ...(Platform.OS !== "web" && {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
              }),
            },
            thumbAnimatedStyle,
          ]}
        >
          {loading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
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
