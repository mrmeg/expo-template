import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Pressable, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { Icon } from "./Icon";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { hapticLight } from "../lib/haptics";
import * as CheckboxPrimitive from "@rn-primitives/checkbox";

const DEFAULT_HIT_SLOP = 8;

/**
 * Size variants for Checkbox
 */
export type CheckboxSize = "sm" | "md" | "lg";

const SIZE_CONFIGS: Record<CheckboxSize, { size: number; iconSize: number; strokeWidth: number }> = {
  sm: { size: 16, iconSize: 12, strokeWidth: 2.5 },
  md: { size: 20, iconSize: 16, strokeWidth: 3 },
  lg: { size: 24, iconSize: 20, strokeWidth: 3.5 },
};

export interface CheckboxProps extends Omit<CheckboxPrimitive.RootProps, "style"> {
  /**
   * Size variant
   * @default "md"
   */
  size?: CheckboxSize;
  /**
   * Optional label text displayed next to the checkbox
   */
  label?: string;
  /**
   * Whether the checkbox is in an indeterminate state (dash icon)
   */
  indeterminate?: boolean;
  /**
   * Whether the checkbox is in an error state
   */
  error?: boolean;
  /**
   * Custom style override (uses StyleSheet.flatten for web compatibility)
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Style for the label text
   */
  labelStyle?: StyleProp<ViewStyle>;
  /**
   * Whether the field is required (shows asterisk in label)
   */
  required?: boolean;
}

function Checkbox({
  size = "md",
  label,
  indeterminate = false,
  error = false,
  style: styleOverride,
  labelStyle,
  required = false,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: CheckboxProps) {
  const { theme, getContrastingColor } = useTheme();
  const reduceMotion = useReducedMotion();
  const sizeConfig = SIZE_CONFIGS[size];

  // Simple fast opacity for the checkmark icon
  const checkOpacity = useSharedValue(checked || indeterminate ? 1 : 0);

  const wrappedOnCheckedChange = (next: boolean) => {
    if (next) hapticLight();

    if (reduceMotion) {
      checkOpacity.value = withTiming(next ? 1 : 0, { duration: 0 });
    } else {
      checkOpacity.value = withTiming(next ? 1 : 0, { duration: 60 });
    }
    onCheckedChange?.(next);
  };

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }));

  // Dynamic border color with sufficient contrast against background
  const borderColor = error
    ? theme.colors.destructive
    : checked || indeterminate
      ? theme.colors.primary
      : getContrastingColor(
        theme.colors.background,
        theme.colors.text,
        theme.colors.textDim
      );

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  const checkboxElement = (
    <CheckboxPrimitive.Root
      {...props}
      checked={checked}
      onCheckedChange={wrappedOnCheckedChange}
      disabled={disabled}
      style={{
        borderColor,
        backgroundColor: checked || indeterminate ? theme.colors.primary : theme.colors.background,
        borderRadius: spacing.radiusSm,
        borderWidth: 1,
        width: sizeConfig.size,
        height: sizeConfig.size,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        ...(Platform.OS === "web" && { cursor: disabled ? "not-allowed" : ("pointer" as any) }),
        ...(flattenedStyle || {}),
      }}
      hitSlop={DEFAULT_HIT_SLOP}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? "mixed" : checked,
        disabled: !!disabled,
      }}
      accessibilityLabel={label}
    >
      <CheckboxPrimitive.Indicator
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.View style={checkAnimatedStyle}>
          {indeterminate ? (
            <Icon
              name="minus"
              size={sizeConfig.iconSize}
              color={theme.colors.primaryForeground}
            />
          ) : (
            <Icon
              name="check"
              size={sizeConfig.iconSize}
              color={theme.colors.primaryForeground}
            />
          )}
        </Animated.View>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  // If no label, return just the checkbox
  if (!label) {
    return checkboxElement;
  }

  // With label, wrap in a container
  return (
    <Pressable
      onPress={() => !disabled && wrappedOnCheckedChange(!checked)}
      style={[styles.container, labelStyle]}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? "mixed" : checked,
        disabled: !!disabled,
      }}
      accessibilityLabel={label}
    >
      {checkboxElement}
      <View style={styles.labelContainer}>
        <StyledText
          selectable={false}
          style={[
            styles.label,
            { color: theme.colors.text },
            disabled && styles.disabledLabel,
            error && { color: theme.colors.destructive },
          ]}
        >
          {label}
          {required && (
            <StyledText selectable={false} style={[styles.required, { color: theme.colors.destructive }]}> *</StyledText>
          )}
        </StyledText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: spacing.touchTarget,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
  },
  disabledLabel: {
    opacity: 0.5,
  },
  required: {
    fontWeight: "bold",
  },
});

export { Checkbox };
