import React, { createContext, useContext, useEffect } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { hapticLight } from "../lib/haptics";
import * as RadioGroupPrimitive from "@rn-primitives/radio-group";

const DEFAULT_HIT_SLOP = 8;

/**
 * Size variants for RadioGroup items
 */
export type RadioGroupSize = "sm" | "md" | "lg";

const SIZE_CONFIGS: Record<RadioGroupSize, { outer: number; inner: number; borderWidth: number }> = {
  sm: { outer: 16, inner: 8, borderWidth: 1 },
  md: { outer: 20, inner: 10, borderWidth: 1 },
  lg: { outer: 24, inner: 12, borderWidth: 1 },
};

// Context to share size, error, and current value from root to items
interface RadioGroupContextValue {
  size: RadioGroupSize;
  error: boolean;
  value: string | undefined;
  onValueChange: (val: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (context === null) {
    throw new Error(
      "RadioGroup compound components cannot be rendered outside the RadioGroup component"
    );
  }
  return context;
}

export interface RadioGroupProps extends Omit<RadioGroupPrimitive.RootProps, "style"> {
  /**
   * Size variant for all items
   * @default "md"
   */
  size?: RadioGroupSize;
  /**
   * Whether the group is in an error state
   */
  error?: boolean;
  /**
   * Custom style override
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * RadioGroup Component
 * A group of radio buttons for single selection.
 * Uses @rn-primitives/radio-group with animated indicators.
 *
 * Usage:
 * ```tsx
 * const [value, setValue] = useState("option1");
 * <RadioGroup value={value} onValueChange={setValue}>
 *   <RadioGroup.Item value="option1" label="Option 1" />
 *   <RadioGroup.Item value="option2" label="Option 2" />
 *   <RadioGroup.Item value="option3" label="Option 3" />
 * </RadioGroup>
 * ```
 */
function RadioGroupRoot({
  size = "md",
  error = false,
  value,
  onValueChange,
  style: styleOverride,
  children,
  ...props
}: RadioGroupProps) {
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  return (
    <RadioGroupContext.Provider value={{ size, error, value, onValueChange }}>
      <RadioGroupPrimitive.Root
        {...props}
        value={value}
        onValueChange={onValueChange}
        style={{
          flexDirection: "column",
          gap: spacing.listItemSpacing,
          ...(flattenedStyle || {}),
        }}
      >
        {children}
      </RadioGroupPrimitive.Root>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps extends Omit<RadioGroupPrimitive.ItemProps, "style"> {
  /**
   * Optional label text displayed next to the radio button
   */
  label?: string;
  /**
   * Whether the field is required (shows asterisk in label)
   */
  required?: boolean;
  /**
   * Custom style override for the radio circle
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Style for the label container row
   */
  labelStyle?: StyleProp<ViewStyle>;
}

/**
 * RadioGroupItem Component
 * Individual radio button with optional label.
 * Must be rendered inside a RadioGroup.
 */
function RadioGroupItem({
  label,
  required = false,
  style: styleOverride,
  labelStyle,
  value: itemValue,
  disabled,
  ...props
}: RadioGroupItemProps) {
  const { theme, getContrastingColor } = useTheme();
  const reduceMotion = useReducedMotion();
  const { size, error, value: groupValue, onValueChange } = useRadioGroupContext();
  const sizeConfig = SIZE_CONFIGS[size];

  const isChecked = groupValue === itemValue;

  // Animated dot scale — follows Checkbox opacity pattern
  const dotScale = useSharedValue(isChecked ? 1 : 0);

  useEffect(() => {
    dotScale.value = reduceMotion
      ? (isChecked ? 1 : 0)
      : withTiming(isChecked ? 1 : 0, { duration: 60 });
  }, [isChecked, reduceMotion, dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  // Wrap onPress to add haptic feedback
  const handlePress = () => {
    hapticLight();
  };

  // Border color follows Checkbox pattern
  const borderColor = error
    ? theme.colors.destructive
    : isChecked
      ? theme.colors.primary
      : getContrastingColor(
        theme.colors.background,
        theme.colors.text,
        theme.colors.textDim
      );

  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  const radioElement = (
    <RadioGroupPrimitive.Item
      {...props}
      value={itemValue}
      disabled={disabled}
      onPress={handlePress}
      style={{
        borderColor,
        backgroundColor: "transparent",
        borderRadius: sizeConfig.outer / 2,
        borderWidth: sizeConfig.borderWidth,
        width: sizeConfig.outer,
        height: sizeConfig.outer,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        ...(flattenedStyle || {}),
      }}
      hitSlop={DEFAULT_HIT_SLOP}
      accessibilityLabel={label}
    >
      {/* Render the dot outside the Indicator so animation works on both
          mount and unmount. The primitive Item already handles aria-checked
          and accessibility state for screen readers. */}
      <Animated.View
        style={[
          dotStyle,
          {
            width: sizeConfig.inner,
            height: sizeConfig.inner,
            borderRadius: sizeConfig.inner / 2,
            backgroundColor: theme.colors.primary,
          },
        ]}
      />
    </RadioGroupPrimitive.Item>
  );

  // If no label, return just the radio button
  if (!label) {
    return radioElement;
  }

  // With label, wrap in a pressable row — tapping the label selects the item
  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          hapticLight();
          onValueChange(itemValue);
        }
      }}
      style={[styles.container, labelStyle]}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{
        checked: isChecked,
        disabled: !!disabled,
      }}
      accessibilityLabel={label}
    >
      {radioElement}
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

// Compound export
const RadioGroupComponent = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

export { RadioGroupComponent as RadioGroup, RadioGroupItem };
