import React, { useState, ReactNode } from "react";
import {
  StyleSheet,
  TextInput as RNTextInput,
  ViewStyle,
  TextStyle,
  TextInputProps,
  StyleProp,
  Platform,
  View,
  Pressable,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import { fontFamilies } from "@/constants/fonts";
import { Text } from "./StyledText";
import { Icon } from "./Icon";

/**
 * Size variants for TextInput
 */
export type TextInputSize = "sm" | "md" | "lg";

/**
 * Visual variants for TextInput
 */
export type TextInputVariant = "outline" | "filled" | "underlined";

const SIZE_CONFIGS: Record<
  TextInputSize,
  {
    height: number;
    fontSize: number;
    paddingVertical: number;
    paddingHorizontal: number;
  }
> = {
  sm: {
    height: 32,
    fontSize: 14,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  md: {
    height: 40,
    fontSize: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  lg: {
    height: 48,
    fontSize: 18,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
};

interface TextInputCustomProps extends TextInputProps {
  /**
   * Visual variant
   * @default "outline"
   */
  variant?: TextInputVariant;
  /**
   * Size variant
   * @default "md"
   */
  size?: TextInputSize;
  /**
   * Label text displayed above the input
   */
  label?: string;
  /**
   * Helper text displayed below the input
   */
  helperText?: string;
  /**
   * Error message displayed below the input (overrides helperText)
   */
  errorText?: string;
  /**
   * Whether the input is in an error state
   */
  error?: boolean;
  /**
   * Whether the field is required (shows asterisk)
   */
  required?: boolean;
  /**
   * Number of rows for multiline input
   */
  rows?: number;
  /**
   * Whether to show the password visibility toggle
   * Only applies when secureTextEntry is true
   */
  showSecureEntryToggle?: boolean;
  /**
   * Custom element to render on the left side of the input
   */
  leftElement?: ReactNode;
  /**
   * Custom element to render on the right side of the input
   */
  rightElement?: ReactNode;
  /**
   * Wrapper view style
   */
  wrapperStyle?: StyleProp<ViewStyle>;
  /**
   * Style applied when input is focused
   */
  focusedStyle?: StyleProp<TextStyle>;
  /**
   * Force light theme colors (useful for dark backgrounds)
   */
  forceLight?: boolean;
}

/**
 * Enhanced TextInput Component
 *
 * Features:
 * - Size variants (sm, md, lg)
 * - Visual variants (outline, filled, underlined)
 * - Error states with error text
 * - Helper text
 * - Required indicator (asterisk)
 * - Left/right custom elements
 * - Password visibility toggle with Lucide icons
 * - Full accessibility support
 * - Disabled state styling
 *
 * Usage:
 * ```tsx
 * // Basic
 * <TextInput label="Email" placeholder="Enter email" />
 *
 * // With error
 * <TextInput
 *   label="Email"
 *   error
 *   errorText="Email is required"
 * />
 *
 * // With helper text
 * <TextInput
 *   label="Password"
 *   helperText="Must be at least 8 characters"
 *   secureTextEntry
 *   showSecureEntryToggle
 * />
 *
 * // With custom elements
 * <TextInput
 *   label="Search"
 *   leftElement={<Icon as={Search} size={20} />}
 * />
 * ```
 */
export const TextInput = React.forwardRef<RNTextInput, TextInputCustomProps>(
  (
    {
      variant = "outline",
      size = "md",
      label,
      helperText,
      errorText,
      error,
      required,
      rows,
      showSecureEntryToggle,
      leftElement,
      rightElement,
      wrapperStyle,
      focusedStyle,
      forceLight,
      secureTextEntry,
      inputMode,
      style,
      onChangeText,
      onFocus,
      onBlur,
      value,
      multiline,
      editable = true,
      ...rest
    },
    ref
  ) => {
    const { theme, getContrastingColor } = useTheme();
    const styles = createStyles(theme, variant, size);
    const [focused, setFocused] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const [passwordVisible, setPasswordVisible] = useState(false);

    const isDisabled = editable === false;
    const hasError = error || !!errorText;

    // Determine background color
    const backgroundColor = forceLight
      ? theme.colors.white
      : variant === "filled"
        ? theme.colors.bgSecondary
        : "transparent";

    // Handle numeric input validation
    const handleNumericChange = (input: string) => {
      const numericRegex = /^[0-9]*$/;
      if (numericRegex.test(input)) {
        onChangeText?.(input);
      }
    };

    const handleTextChange = (input: string) => {
      onChangeText?.(input);
    };

    const sizeConfig = SIZE_CONFIGS[size];

    // Pre-calculate all values to avoid expensive recalculations on every keystroke
    const borderColor = hasError
      ? theme.colors.error
      : focused
        ? theme.colors.primary
        : forceLight
          ? "#d1d5db"
          : theme.colors.bgTertiary;

    const inputPaddingLeft = leftElement
      ? sizeConfig.paddingHorizontal + spacing.xl
      : sizeConfig.paddingHorizontal;

    const inputPaddingRight = rightElement || (secureTextEntry && showSecureEntryToggle)
      ? sizeConfig.paddingHorizontal + spacing.xl
      : sizeConfig.paddingHorizontal;

    const textColor = forceLight
      ? "#1f2937"
      : getContrastingColor(
          backgroundColor === "transparent" ? theme.colors.bgPrimary : backgroundColor,
          theme.colors.textPrimary,
          theme.colors.white
        );

    const shouldScroll = multiline && rest.scrollEnabled !== false && contentHeight > 100;

    return (
      <View style={wrapperStyle}>
        {/* Label */}
        {label && (
          <View style={styles.labelContainer}>
            <Text style={styles.label}>
              {label}
              {required && <Text style={styles.required}> *</Text>}
            </Text>
          </View>
        )}

        {/* Input Container */}
        <View style={styles.wrapper}>
          {/* Left Element */}
          {leftElement && <View style={styles.leftElement}>{leftElement}</View>}

          {/* Text Input */}
          <RNTextInput
            ref={ref}
            {...rest}
            editable={editable}
            inputMode={inputMode || "text"}
            multiline={multiline}
            numberOfLines={rows}
            secureTextEntry={secureTextEntry && !passwordVisible}
            onChangeText={
              inputMode === "numeric" ? handleNumericChange : handleTextChange
            }
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            onContentSizeChange={(e) =>
              setContentHeight(e.nativeEvent.contentSize.height)
            }
            scrollEnabled={shouldScroll}
            placeholderTextColor={theme.colors.neutral}
            style={[
              styles.input,
              {
                backgroundColor,
                borderColor,
                color: textColor,
                fontSize: sizeConfig.fontSize,
                minHeight: multiline ? undefined : sizeConfig.height,
                paddingVertical: sizeConfig.paddingVertical,
                paddingLeft: inputPaddingLeft,
                paddingRight: inputPaddingRight,
              },
              variant === "underlined" && styles.underlined,
              variant === "filled" && styles.filled,
              style,
              focused && focusedStyle,
              isDisabled && styles.disabled,
              hasError && styles.error,
              Platform.OS === "web" && { fontSize: Math.max(sizeConfig.fontSize, 16) },
            ]}
            textAlignVertical={multiline ? "top" : "center"}
            value={value}
            accessibilityLabel={label}
            accessibilityHint={helperText || errorText}
            accessibilityState={{ disabled: isDisabled }}
            aria-invalid={hasError}
            aria-required={required}
          />

          {/* Right Element or Password Toggle */}
          {rightElement && !secureTextEntry && (
            <View style={styles.rightElement}>{rightElement}</View>
          )}

          {secureTextEntry && showSecureEntryToggle && (
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible(!passwordVisible)}
              accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              <Icon
                as={passwordVisible ? EyeOff : Eye}
                size={spacing.iconSm + 4}
                color="neutral"
              />
            </Pressable>
          )}
        </View>

        {/* Helper Text or Error Text */}
        {(helperText || errorText) && (
          <Text
            style={[
              styles.helperText,
              hasError && styles.errorText,
            ]}
          >
            {errorText || helperText}
          </Text>
        )}
      </View>
    );
  }
);

TextInput.displayName = "TextInput";

const createStyles = (theme: any, variant: TextInputVariant, size: TextInputSize) =>
  StyleSheet.create({
    wrapper: {
      width: "100%",
      position: "relative",
      backgroundColor: "transparent",
    },
    input: {
      fontFamily: fontFamilies.sansSerif.regular,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      ...(Platform.OS === "web" && { outlineStyle: "none" as any }),
    },
    underlined: {
      borderRadius: 0,
      borderWidth: 0,
      borderBottomWidth: 2,
    },
    filled: {
      borderWidth: 0,
      borderBottomWidth: 2,
    },
    disabled: {
      opacity: 0.6,
      ...(Platform.OS === "web" && { cursor: "not-allowed" as any }),
    },
    error: {
      borderColor: theme.colors.error,
    },
    labelContainer: {
      flexDirection: "row",
      marginBottom: spacing.xs,
    },
    label: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
    required: {
      color: theme.colors.error,
      fontFamily: fontFamilies.sansSerif.bold,
    },
    helperText: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: 12,
      color: theme.colors.neutral,
      marginTop: spacing.xs,
    },
    errorText: {
      color: theme.colors.error,
    },
    leftElement: {
      position: "absolute",
      left: spacing.sm,
      top: "50%",
      transform: [{ translateY: -10 }],
      zIndex: 1,
    },
    rightElement: {
      position: "absolute",
      right: spacing.sm,
      top: "50%",
      transform: [{ translateY: -10 }],
      zIndex: 1,
    },
    passwordToggle: {
      position: "absolute",
      right: spacing.sm,
      top: "50%",
      transform: [{ translateY: Platform.OS === "web" ? -10 : -12 }],
      zIndex: 1,
      ...(Platform.OS === "web" && { cursor: "pointer" as any }),
    },
  });
