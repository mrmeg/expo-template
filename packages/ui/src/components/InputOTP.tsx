import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  TextInput as RNTextInput,
  Pressable,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { fontFamilies } from "../constants/fonts";
import { StyledText } from "./StyledText";
import type { Theme } from "../constants/colors";

export interface InputOTPProps {
  /**
   * Number of OTP cells
   * @default 6
   */
  length?: number;
  /**
   * Current value
   * @default ""
   */
  value?: string;
  /**
   * Called when the value changes
   */
  onChangeText?: (value: string) => void;
  /**
   * Called when all cells are filled
   */
  onComplete?: (value: string) => void;
  /**
   * Whether the input is in an error state
   * @default false
   */
  error?: boolean;
  /**
   * Error message displayed below the cells
   */
  errorText?: string;
  /**
   * Whether the input is disabled
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether to auto-focus the input on mount
   * @default false
   */
  autoFocus?: boolean;
  /**
   * Whether to mask the input with bullet characters
   * @default false
   */
  secureTextEntry?: boolean;
  /**
   * Input mode for the keyboard
   * @default "numeric"
   */
  inputMode?: "numeric" | "text";
  /**
   * Custom style override for the container
   */
  style?: StyleProp<ViewStyle>;
}

const CELL_WIDTH = 36;
const CELL_HEIGHT = 40;
const CELL_FONT_SIZE = 20;
const CELL_FONT_WEIGHT = "600" as const;
const BULLET = "\u2022";

/**
 * OTP/verification code input with individual character cells.
 *
 * A single hidden TextInput captures keyboard input. Visible cells are
 * Pressable views that focus the hidden input on tap.
 *
 * Usage:
 * ```tsx
 * <InputOTP
 *   length={6}
 *   value={code}
 *   onChangeText={setCode}
 *   onComplete={(code) => verify(code)}
 * />
 * ```
 */
function InputOTP({
  length = 6,
  value = "",
  onChangeText,
  onComplete,
  error = false,
  errorText,
  disabled = false,
  autoFocus = false,
  secureTextEntry = false,
  inputMode = "numeric",
  style: styleOverride,
}: InputOTPProps) {
  const { theme } = useTheme();
  const inputRef = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasError = error || !!errorText;

  // Active cell index: next empty cell, or last cell when full
  const activeIndex = Math.min(value.length, length - 1);

  const focusInput = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleChangeText = useCallback(
    (text: string) => {
      // Filter non-digits when numeric mode
      let filtered = text;
      if (inputMode === "numeric") {
        filtered = text.replace(/[^0-9]/g, "");
      }

      // Truncate to length
      const truncated = filtered.slice(0, length);

      onChangeText?.(truncated);

      if (truncated.length === length) {
        onComplete?.(truncated);
      }
    },
    [inputMode, length, onChangeText, onComplete],
  );

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === "Backspace" && value.length === 0) {
        // Already empty, nothing to do
        return;
      }
    },
    [value],
  );

  const markOtpFocused = useCallback(() => {
    setFocused(true);
  }, []);

  const markOtpBlurred = useCallback(() => {
    setFocused(false);
  }, []);

  return (
    <View style={StyleSheet.flatten([styles.container, styleOverride])}>
      {/* Hidden input */}
      <RNTextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onFocus={markOtpFocused}
        onBlur={markOtpBlurred}
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        inputMode={inputMode}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="Verification code input"
        importantForAccessibility="yes"
      />

      {/* Visible cells */}
      <View style={styles.cellRow}>
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? "";
          const isActive = focused && index === activeIndex;
          const displayChar = char
            ? secureTextEntry
              ? BULLET
              : char
            : "";

          return (
            <OTPCell
              key={index}
              index={index}
              total={length}
              char={displayChar}
              isActive={isActive}
              hasError={hasError}
              disabled={disabled}
              theme={theme}
              onPress={focusInput}
            />
          );
        })}
      </View>

      {/* Error text */}
      {!!errorText && (
        <StyledText style={styles.errorText}>
          {errorText}
        </StyledText>
      )}
    </View>
  );
}

/**
 * Individual OTP cell with animated border.
 */
interface OTPCellProps {
  index: number;
  total: number;
  char: string;
  isActive: boolean;
  hasError: boolean;
  disabled: boolean;
  theme: Theme;
  onPress: () => void;
}

function OTPCell({
  index,
  total,
  char,
  isActive,
  hasError,
  disabled,
  theme,
  onPress,
}: OTPCellProps) {
  // borderWidth is a layout property — animating it forces a JS-thread layout
  // pass every frame. The 1↔2px and color changes read as instant for OTP
  // cells, so compute both during render.
  const borderWidth = isActive && !hasError ? 2 : 1;
  const borderColor = hasError
    ? theme.colors.destructive
    : isActive
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Digit ${index + 1} of ${total}`}
      accessibilityState={{ disabled }}
    >
      <View
        style={[
          {
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
            borderRadius: spacing.radiusMd,
            borderWidth,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "transparent",
            opacity: disabled ? 0.5 : 1,
            borderColor,
          },
        ]}
      >
        <StyledText
          selectable={false}
          style={{
            fontSize: CELL_FONT_SIZE,
            fontWeight: CELL_FONT_WEIGHT,
            fontFamily: fontFamilies.sansSerif.regular,
            color: theme.colors.text,
            textAlign: "center",
            lineHeight: CELL_FONT_SIZE * 1.2,
          }}
        >
          {char}
        </StyledText>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
    },
    hiddenInput: {
      position: "absolute",
      width: 1,
      height: 1,
      opacity: 0,
      ...(Platform.OS === "web" && { caretColor: "transparent" as any }),
    },
    cellRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    errorText: {
      fontSize: 12,
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.destructive,
      marginTop: spacing.xs,
    },
  });

export { InputOTP };
