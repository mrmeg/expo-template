import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from "react-native";
import { Icon } from "@/client/components/ui/Icon";
import { StyledText } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as CheckboxPrimitive from "@rn-primitives/checkbox";
import { Check, Minus } from "lucide-react-native";

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

/**
 * Enhanced Checkbox Component
 *
 * Features:
 * - Size variants (sm, md, lg)
 * - Optional label with required indicator
 * - Indeterminate state (dash icon)
 * - Error state styling
 * - Style prop support with web compatibility
 * - Full accessibility support
 * - Disabled state
 *
 * Usage:
 * ```tsx
 * // Basic
 * const [checked, setChecked] = useState(false);
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // With label
 * <Checkbox
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   label="Accept terms"
 *   required
 * />
 *
 * // Indeterminate state
 * <Checkbox
 *   checked={false}
 *   indeterminate
 *   label="Select all"
 * />
 *
 * // With error
 * <Checkbox
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   label="Required field"
 *   error
 * />
 *
 * // Different sizes
 * <Checkbox size="sm" checked={checked} onCheckedChange={setChecked} />
 * <Checkbox size="lg" checked={checked} onCheckedChange={setChecked} />
 * ```
 */
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
  const sizeConfig = SIZE_CONFIGS[size];

  // Dynamic border color with sufficient contrast against background
  // React 19 compiler automatically memoizes this calculation
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
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      style={{
        borderColor,
        backgroundColor: "transparent",
        borderRadius: spacing.radiusSm,
        borderWidth: 2,
        width: sizeConfig.size,
        height: sizeConfig.size,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
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
        {indeterminate ? (
          <Icon
            as={Minus}
            size={sizeConfig.iconSize}
            strokeWidth={sizeConfig.strokeWidth}
            color="primary"
          />
        ) : (
          <Icon
            as={Check}
            size={sizeConfig.iconSize}
            strokeWidth={sizeConfig.strokeWidth}
            color="primary"
          />
        )}
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
      onPress={() => !disabled && onCheckedChange?.(!checked)}
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
          style={[
            styles.label,
            { color: theme.colors.text },
            disabled && styles.disabledLabel,
            error && { color: theme.colors.destructive },
          ]}
        >
          {label}
          {required && (
            <StyledText style={[styles.required, { color: theme.colors.destructive }]}> *</StyledText>
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
