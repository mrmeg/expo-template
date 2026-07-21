import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Pressable, PressableProps, Platform, Animated } from "react-native";
import { Icon } from "./Icon";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { hapticLight } from "../lib/haptics";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useScalePress } from "../hooks/useScalePress";
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
  const { theme, getContrastingColor, getFocusRingStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  const sizeConfig = SIZE_CONFIGS[size];
  const focusRingStyle = getFocusRingStyle();
  const [focused, setFocused] = useState(false);
  const { animatedStyle: scaleStyle, pressHandlers } = useScalePress({
    disabled: !!disabled,
    scaleTo: 0.92,
    haptic: false,
  });

  const showFocusRing: PressableProps["onFocus"] = (event) => {
    let ringVisible = true;
    if (Platform.OS === "web") {
      const target = event?.nativeEvent?.target as unknown as
        | { matches?: (selector: string) => boolean }
        | null
        | undefined;
      if (target && typeof target.matches === "function") {
        try {
          ringVisible = target.matches(":focus-visible");
        } catch {
          ringVisible = true;
        }
      }
    }
    setFocused(ringVisible);
  };

  const hideFocusRing: PressableProps["onBlur"] = () => {
    setFocused(false);
  };

  // Simple fast opacity for the checkmark icon
  const checkOpacity = useRef(new Animated.Value(checked || indeterminate ? 1 : 0)).current;
  const isVisuallyChecked = !!checked || indeterminate;

  const animateCheckOpacity = useCallback(
    (nextVisible: boolean) => {
      Animated.timing(checkOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: reduceMotion ? 0 : 60,
        useNativeDriver: true,
      }).start();
    },
    [checkOpacity, reduceMotion],
  );

  useEffect(() => {
    animateCheckOpacity(isVisuallyChecked);
  }, [animateCheckOpacity, isVisuallyChecked]);

  const wrappedOnCheckedChange = (next: boolean) => {
    if (next) hapticLight();
    animateCheckOpacity(next);
    onCheckedChange?.(next);
  };

  // Dynamic border color with sufficient contrast against background
  const borderColor = error
    ? theme.colors.destructive
    : isVisuallyChecked
      ? theme.colors.primary
      : getContrastingColor(
        theme.colors.background,
        theme.colors.text,
        theme.colors.textDim
      );

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  const checkboxElement = (
    <Animated.View style={scaleStyle}>
      <CheckboxPrimitive.Root
        {...props}
        checked={checked}
        onCheckedChange={wrappedOnCheckedChange}
        disabled={disabled}
        onPressIn={pressHandlers.onPressIn}
        onPressOut={pressHandlers.onPressOut}
        onFocus={showFocusRing}
        onBlur={hideFocusRing}
        style={{
          ...styles.box,
          borderColor,
          backgroundColor: isVisuallyChecked ? theme.colors.primary : theme.colors.background,
          width: sizeConfig.size,
          height: sizeConfig.size,
          opacity: disabled ? 0.5 : 1,
          ...(Platform.OS === "web" && { cursor: disabled ? "not-allowed" : ("pointer" as any) }),
          ...(focused && !disabled ? focusRingStyle : null),
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
          <Animated.View style={{ opacity: checkOpacity }}>
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
    </Animated.View>
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
  box: {
    // radiusXs (not radiusSm) — at the checkbox's 16-24px sizes, radiusSm
    // post-rebase (8px) reads as over-rounded; radiusXs keeps the same
    // proportion the box had before the radius rebase.
    borderRadius: spacing.radiusXs,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
