import React, { useEffect, useRef } from "react";
import { Platform, Animated, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { useReducedMotion } from "react-native-reanimated";
import { spacing } from "@/client/constants/spacing";
import * as SwitchPrimitives from "@rn-primitives/switch";
import { fontFamilies } from "@/client/constants/fonts";
import { StyledText } from "./StyledText";
import { palette } from "@/client/constants/colors";

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
   * Custom size for the thumb (sliding circle).
   * Defaults to height - 4 (2px padding on each side).
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
  /**
   * Animation configuration - tension for spring animation
   * @default 180
   */
  animationTension?: number;
  /**
   * Animation configuration - friction for spring animation
   * @default 12
   */
  animationFriction?: number;
}

/**
 * Enhanced Switch Component
 *
 * Features:
 * - Variants (default, ios)
 * - Loading state with spinner
 * - Style prop support
 * - Configurable animations
 * - Optional labels (ON/OFF)
 * - Custom sizing
 * - Full accessibility support
 *
 * Usage:
 * ```tsx
 * // Basic
 * const [checked, setChecked] = useState(false);
 * <Switch checked={checked} onCheckedChange={setChecked} />
 *
 * // With labels
 * <Switch
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   labelOn="ON"
 *   labelOff="OFF"
 * />
 *
 * // iOS variant
 * <Switch
 *   variant="ios"
 *   checked={checked}
 *   onCheckedChange={setChecked}
 * />
 *
 * // With loading state
 * <Switch
 *   checked={checked}
 *   loading
 *   onCheckedChange={setChecked}
 * />
 *
 * // Custom size and style
 * <Switch
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   size={{ width: 70, height: 36 }}
 *   thumbSize={32}
 *   style={{ marginVertical: 10 }}
 * />
 * ```
 */
function Switch({
  variant = "default",
  labelOn,
  labelOff,
  size = { width: 44, height: 24 },
  thumbSize: thumbSizeProp,
  loading = false,
  style: styleOverride,
  animationTension = 180,
  animationFriction = 12,
  ...props
}: SwitchProps) {
  const { theme, getContrastingColor, withAlpha } = useTheme();
  const reduceMotion = useReducedMotion();

  // Thumb is inset within the track with consistent padding
  const trackPadding = 2;
  const thumbSize = thumbSizeProp ?? size.height - trackPadding * 2;

  // Track colors
  const isIOS = variant === "ios";
  const trackColorOn = isIOS ? "#34C759" : theme.colors.accent;
  const trackColorOff = theme.colors.muted;

  // Calculate label color for ON state
  const labelOnColor = getContrastingColor(
    trackColorOn,
    palette.white,
    palette.black
  );

  // Calculate sizes
  const labelFontSize = size.height / 3;

  // Animation values
  const thumbPosition = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOnOpacity = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOffOpacity = useRef(new Animated.Value(props.checked ? 0 : 1)).current;

  // Animate on checked state change
  useEffect(() => {
    const target = props.checked ? 1 : 0;

    if (reduceMotion) {
      thumbPosition.setValue(target);
      labelOnOpacity.setValue(target);
      labelOffOpacity.setValue(props.checked ? 0 : 1);
      return;
    }

    const useNativeDriver = Platform.OS !== "web";

    Animated.parallel([
      Animated.spring(thumbPosition, {
        toValue: target,
        tension: animationTension,
        friction: animationFriction,
        useNativeDriver,
      }),
      Animated.timing(labelOnOpacity, {
        toValue: target,
        duration: 150,
        useNativeDriver,
      }),
      Animated.timing(labelOffOpacity, {
        toValue: props.checked ? 0 : 1,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  }, [props.checked, thumbPosition, labelOnOpacity, labelOffOpacity, animationTension, animationFriction, reduceMotion]);

  // Interpolate thumb position — stays within track padding
  const animatedThumbTranslateX = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [trackPadding, size.width - thumbSize - trackPadding],
  });

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  return (
    <SwitchPrimitives.Root
      {...props}
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        backgroundColor: props.checked ? trackColorOn : trackColorOff,
        justifyContent: "center",
        overflow: "hidden",
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
      {/* Label ON - shown when checked (not shown in iOS variant) */}
      {labelOn && !isIOS && (
        <Animated.View
          style={{
            position: "absolute",
            left: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: labelOnOpacity,
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
        </Animated.View>
      )}

      {/* Thumb (sliding circle) */}
      <SwitchPrimitives.Thumb asChild>
        <Animated.View
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: palette.white,
            transform: [{ translateX: animatedThumbTranslateX }],
            justifyContent: "center",
            alignItems: "center",
            // Cross-platform shadow for depth
            ...(Platform.OS === "web"
              ? {
                  boxShadow: `0 1px 3px ${withAlpha(palette.black, 0.2)}`,
                } as any
              : {
                  shadowColor: palette.black,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 2,
                }),
          }}
        >
          {/* Loading spinner inside thumb */}
          {loading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
            />
          )}
        </Animated.View>
      </SwitchPrimitives.Thumb>

      {/* Label OFF - shown when unchecked (not shown in iOS variant) */}
      {labelOff && !isIOS && (
        <Animated.View
          style={{
            position: "absolute",
            right: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: labelOffOpacity,
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
        </Animated.View>
      )}
    </SwitchPrimitives.Root>
  );
}

export { Switch };
