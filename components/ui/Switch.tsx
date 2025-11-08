import React, { useEffect, useRef } from "react";
import { Platform, Animated, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import * as SwitchPrimitives from "@rn-primitives/switch";
import { fontFamilies } from "@/constants/fonts";
import { Text } from "./StyledText";

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
   * Default: { width: 52, height: 28 }
   */
  size?: { width: number; height: number };
  /**
   * Custom size for the thumb (sliding circle)
   * Default: 24
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
  size = { width: 52, height: 28 },
  thumbSize = 24,
  loading = false,
  style: styleOverride,
  animationTension = 180,
  animationFriction = 12,
  ...props
}: SwitchProps) {
  const { theme, getContrastingColor } = useTheme();

  // Dynamic border color with sufficient contrast against background
  const borderColor = getContrastingColor(
    theme.colors.bgPrimary,
    theme.colors.bgTertiary,
    theme.colors.neutral
  );

  // Calculate label color for ON state (when checked, background is primary)
  const labelOnColor = getContrastingColor(
    theme.colors.primary,
    theme.colors.textLight,
    theme.colors.textDark
  );

  // Calculate sizes
  const labelFontSize = size.height / 3;

  // Animation values
  const thumbPosition = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOnOpacity = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOffOpacity = useRef(new Animated.Value(props.checked ? 0 : 1)).current;

  // Animate on checked state change
  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";

    Animated.parallel([
      Animated.spring(thumbPosition, {
        toValue: props.checked ? 1 : 0,
        tension: animationTension,
        friction: animationFriction,
        useNativeDriver,
      }),
      Animated.timing(labelOnOpacity, {
        toValue: props.checked ? 1 : 0,
        duration: 150,
        useNativeDriver,
      }),
      Animated.timing(labelOffOpacity, {
        toValue: props.checked ? 0 : 1,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  }, [props.checked, thumbPosition, labelOnOpacity, labelOffOpacity, animationTension, animationFriction]);

  // Interpolate thumb position
  const animatedThumbTranslateX = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [2, size.width - thumbSize - 2],
  });

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  // iOS variant styling
  const isIOS = variant === "ios";
  const iosBackgroundColor = props.checked
    ? "#34C759" // iOS green
    : theme.colors.bgTertiary;

  return (
    <SwitchPrimitives.Root
      {...props}
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        borderWidth: isIOS ? 0 : 0.75,
        borderColor: props.checked ? theme.colors.primary : borderColor,
        backgroundColor: isIOS
          ? iosBackgroundColor
          : (props.checked ? theme.colors.primary : theme.colors.bgTertiary),
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
          <Text
            style={{
              fontFamily: fontFamilies.sansSerif.bold,
              fontSize: labelFontSize,
              color: labelOnColor,
              userSelect: "none",
            }}
          >
            {labelOn}
          </Text>
        </Animated.View>
      )}

      {/* Thumb (sliding circle) */}
      <SwitchPrimitives.Thumb asChild>
        <Animated.View
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: theme.colors.white,
            transform: [{ translateX: animatedThumbTranslateX }],
            justifyContent: "center",
            alignItems: "center",
            ...(Platform.OS !== "web" && {
              shadowColor: theme.colors.overlay,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isIOS ? 0.15 : 0.25,
              shadowRadius: isIOS ? 2 : 3,
              elevation: isIOS ? 2 : 3,
            }),
          }}
        >
          {/* Loading spinner inside thumb */}
          {loading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
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
          <Text
            style={{
              fontFamily: fontFamilies.sansSerif.bold,
              fontSize: labelFontSize,
              color: theme.colors.textPrimary,
              userSelect: "none",
            }}
          >
            {labelOff}
          </Text>
        </Animated.View>
      )}
    </SwitchPrimitives.Root>
  );
}

export { Switch };
