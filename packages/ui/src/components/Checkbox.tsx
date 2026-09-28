import React, { useCallback, useEffect } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Pressable, Platform, Animated } from "react-native";
import { Icon } from "./Icon";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { spacing } from "../constants/spacing";
import { hapticSelection } from "../lib/haptics";
import { interaction } from "../constants/interaction";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useScalePress } from "../hooks/useScalePress";
import { shouldUseNativeDriver } from "../lib/animations";
import * as CheckboxPrimitive from "@rn-primitives/checkbox";
import { useItemControlLabel } from "./Item";

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
  const { animatedStyle: scaleStyle, pressHandlers } = useScalePress({
    disabled: !!disabled,
    scaleTo: 0.92,
    haptic: false,
  });

  const { focused, onFocus: showFocusRing, onBlur: hideFocusRing } = useFocusVisible();

  // Simple fast opacity for the checkmark icon
  const checkOpacity = useAnimatedValue(checked || indeterminate ? 1 : 0);
  const isVisuallyChecked = !!checked || indeterminate;

  const animateCheckOpacity = useCallback(
    (nextVisible: boolean) => {
      Animated.timing(checkOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: reduceMotion ? 0 : 60,
        useNativeDriver: shouldUseNativeDriver,
      }).start();
    },
    [checkOpacity, reduceMotion],
  );

  useEffect(() => {
    animateCheckOpacity(isVisuallyChecked);
  }, [animateCheckOpacity, isVisuallyChecked]);

  const wrappedOnCheckedChange = (next: boolean) => {
    if (next) hapticSelection();
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

  // The primitive Root is the ONE control (role, state, name); the visual box
  // is a child so the control can be larger than what it draws. On web, where
  // `hitSlop` does nothing, a 16/20px box is below the 24px WCAG 2.5.8 minimum,
  // so the control grows to `spacing.minTarget` and takes the extra back in
  // negative margins — the row's layout does not move.
  const hitSize = Platform.OS === "web" ? Math.max(sizeConfig.size, spacing.minTarget) : sizeConfig.size;
  const hitOverflow = (hitSize - sizeConfig.size) / 2;
  // The label text names the control on every platform (react-native-web
  // maps `accessibilityLabel` to `aria-label`); no `useId` link, because ids
  // do not survive Expo Router's streamed hydration (see hooks/useHydrated).
  const rowLabel = useItemControlLabel({ ...props, accessibilityLabel: label });
  const labelLink = label !== undefined ? { accessibilityLabel: label } : rowLabel;

  const checkboxElement = (
    <Animated.View style={scaleStyle}>
      <CheckboxPrimitive.Root
        {...labelLink}
        {...props}
        checked={checked}
        onCheckedChange={wrappedOnCheckedChange}
        disabled={disabled}
        onPressIn={pressHandlers.onPressIn}
        onPressOut={pressHandlers.onPressOut}
        onFocus={showFocusRing}
        onBlur={hideFocusRing}
        style={{
          ...styles.control,
          minWidth: hitSize,
          minHeight: hitSize,
          ...(hitOverflow > 0 && { margin: -hitOverflow }),
          ...(Platform.OS === "web" && { cursor: disabled ? "not-allowed" : ("pointer" as any) }),
        }}
        hitSlop={DEFAULT_HIT_SLOP}
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: indeterminate ? "mixed" : checked,
          disabled: !!disabled,
        }}
      >
        <View
          style={{
            ...styles.box,
            borderColor,
            backgroundColor: isVisuallyChecked ? theme.colors.primary : theme.colors.background,
            width: sizeConfig.size,
            height: sizeConfig.size,
            opacity: disabled ? 0.5 : 1,
            ...(focused && !disabled ? focusRingStyle : null),
            ...(flattenedStyle || {}),
          }}
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
        </View>
      </CheckboxPrimitive.Root>
    </Animated.View>
  );

  // If no label, return just the checkbox
  if (!label) {
    return checkboxElement;
  }

  // With a label, a non-accessible wrapper extends the tap area to the text.
  // It carries no role or state: the primitive Root above is the only control
  // a screen reader meets, and it carries the label text as its name.
  return (
    <Pressable
      onPress={() => !disabled && wrappedOnCheckedChange(!checked)}
      style={[styles.container, labelStyle]}
      disabled={disabled}
      accessible={false}
      focusable={false}
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

const styles = /*#__PURE__*/ StyleSheet.create({
  control: {
    justifyContent: "center",
    alignItems: "center",
  },
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
    minHeight: Platform.select({ web: spacing.formRowMinHeight, default: spacing.touchTarget }),
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
  },
  disabledLabel: {
    opacity: interaction.disabledOpacity,
  },
  required: {
    fontWeight: "bold",
  },
});

export { Checkbox };
