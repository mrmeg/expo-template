import {
  useEffect,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
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
import {
  Host,
  TextInput as ExpoTextInput,
  useNativeState,
  type TextInputRef as ExpoTextInputRef,
} from "@expo/ui";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { fontFamilies } from "../constants/fonts";
import { StyledText } from "./StyledText";
import { Icon } from "./Icon";
import { hapticLight } from "../lib/haptics";
import type { Theme } from "../constants/colors";
import { palette } from "../constants/colors";
import {
  clearKeyboardFocusedInputLayout,
  setKeyboardFocusedInputLayout,
  type KeyboardFocusedInputToken,
} from "./keyboardFocusRegistry";

/**
 * Size variants for TextInput
 */
export type TextInputSize = "sm" | "md" | "lg";

/**
 * Visual variants for TextInput
 */
export type TextInputVariant = "outline" | "filled" | "underlined";

const NUMERIC_REGEX = /^[0-9]*$/;

const SIZE_CONFIGS: Record<
  TextInputSize,
  {
    height: number;
    fontSize: number;
    paddingVertical: number;
    paddingHorizontal: number;
    /**
     * Symmetric vertical padding for the native (`@expo/ui`) field. Chosen so the
     * field's total height (text line + 2× padding) lands near `height`, but WITHOUT
     * forcing a fixed height — on Android, Compose's BasicTextField decoration box
     * defaults to `contentAlignment = topStart`, so a fixed-height box pins text to
     * the top with the slack falling to the bottom. Sizing via padding centers the
     * text instead. See `boxStyle` in NativeTextInput.
     */
    nativePaddingVertical: number;
  }
> = {
  sm: {
    height: 32,
    fontSize: 13,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    nativePaddingVertical: 7,
  },
  md: {
    height: 36,
    fontSize: 14,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    nativePaddingVertical: 8,
  },
  lg: {
    height: 40,
    fontSize: 15,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    nativePaddingVertical: 10,
  },
};

interface TextInputCustomProps extends TextInputProps {
  /**
   * Forwarded ref to the underlying RNTextInput element.
   */
  ref?: Ref<RNTextInput>;
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
   * Shows an X button to clear the input when it has a value.
   * Not shown alongside showSecureEntryToggle or on multiline inputs.
   * @default false
   */
  clearable?: boolean;
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
 * - Password visibility toggle with eye/eye-off icons
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
export function TextInput(props: TextInputCustomProps) {
  // On iOS/Android, route to the native @expo/ui field for flicker-free,
  // platform-native text editing. Web keeps the full-featured RN implementation
  // (no flicker problem there, and it preserves every in-field affordance).
  if (Platform.OS !== "web") {
    return <NativeTextInput {...props} />;
  }
  return <WebTextInput {...props} />;
}

/**
 * Web / fallback implementation — the original React Native TextInput with the
 * complete chrome (variants, sizes, overlays, password toggle, clear button,
 * error icon). Unchanged from the pre-native version.
 */
function WebTextInput({
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
  clearable = false,
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
  ref,
  ...rest
}: TextInputCustomProps) {
  const { theme, getContrastingColor, getFocusRingStyle } = useTheme();
  const styles = useMemo(() => createStyles(theme, variant, size), [theme, variant, size]);
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isDisabled = editable === false;
  const hasError = error || !!errorText;

  // Determine background color
  const backgroundColor = forceLight
    ? palette.white
    : variant === "filled"
      ? theme.colors.card
      : "transparent";

  // Handle numeric input validation
  const handleNumericChange = (input: string) => {
    if (NUMERIC_REGEX.test(input)) {
      onChangeText?.(input);
    }
  };

  const handleTextChange = (input: string) => {
    onChangeText?.(input);
  };

  const sizeConfig = SIZE_CONFIGS[size];

  // Pre-calculate all values to avoid expensive recalculations on every keystroke
  const borderColor = hasError
    ? theme.colors.destructive
    : focused
      ? theme.colors.ring
      : forceLight
        ? "#d1d5db"
        : theme.colors.input;

  const inputPaddingLeft = leftElement
    ? sizeConfig.paddingHorizontal + spacing.xl
    : sizeConfig.paddingHorizontal;

  const hasSecureToggle = !!(secureTextEntry && showSecureEntryToggle);
  const showClearButton = clearable && !hasSecureToggle && !multiline && !isDisabled && !!value;
  const hasRightSlot = !!rightElement || hasSecureToggle || showClearButton;
  const showErrorIcon = hasError && !hasRightSlot && !multiline;

  const inputPaddingRight = hasRightSlot || showErrorIcon
    ? sizeConfig.paddingHorizontal + spacing.xl
    : sizeConfig.paddingHorizontal;

  const textColor = forceLight
    ? "#1f2937"
    : getContrastingColor(
      backgroundColor === "transparent" ? theme.colors.background : backgroundColor,
      theme.colors.text,
      palette.white
    );

  const shouldScroll = multiline && rest.scrollEnabled !== false && contentHeight > 100;

  const showInputFocusRing = (e: any) => {
    setFocused(true);
    onFocus?.(e);
  };

  const hideInputFocusRing = (e: any) => {
    setFocused(false);
    onBlur?.(e);
  };

  const togglePasswordVisible = () => {
    setPasswordVisible(v => !v);
  };

  return (
    <View style={wrapperStyle}>
      {/* Label */}
      {!!label && (
        <View style={styles.labelContainer}>
          <StyledText selectable={false} style={styles.label}>
            {label}
            {required && <StyledText selectable={false} style={styles.required}> *</StyledText>}
          </StyledText>
        </View>
      )}

      {/* Input Container */}
      <View style={[styles.wrapper, focused && getFocusRingStyle()]}>
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
          onFocus={showInputFocusRing}
          onBlur={hideInputFocusRing}
          onContentSizeChange={(e) =>
            setContentHeight(e.nativeEvent.contentSize.height)
          }
          scrollEnabled={shouldScroll}
          placeholderTextColor={theme.colors.textDim}
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

        {/* Right Element, Clear Button, or Password Toggle */}
        {showClearButton && !rightElement && (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              hapticLight();
              onChangeText?.("");
            }}
            accessibilityLabel="Clear input"
            accessibilityRole="button"
          >
            <Icon name="x" size={spacing.iconSm} color="textDim" decorative />
          </Pressable>
        )}

        {showClearButton && rightElement && !hasSecureToggle && (
          <View style={styles.rightElements}>
            <Pressable
              onPress={() => {
                hapticLight();
                onChangeText?.("");
              }}
              accessibilityLabel="Clear input"
              accessibilityRole="button"
            >
              <Icon name="x" size={spacing.iconSm} color="textDim" decorative />
            </Pressable>
            {rightElement}
          </View>
        )}

        {!showClearButton && rightElement && !hasSecureToggle && (
          <View style={styles.rightElement}>{rightElement}</View>
        )}

        {secureTextEntry && showSecureEntryToggle && (
          <Pressable
            style={styles.passwordToggle}
            onPress={togglePasswordVisible}
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <Icon
              name={passwordVisible ? "eye-off" : "eye"}
              size={spacing.iconSm + 4}
              color="textDim"
            />
          </Pressable>
        )}

        {showErrorIcon && (
          <View
            style={[styles.errorIcon, { pointerEvents: "none" }]}
            accessibilityLabel="Error"
          >
            <Icon
              name="alert-circle"
              size={spacing.iconSm}
              color="destructive"
              decorative
            />
          </View>
        )}
      </View>

      {/* Helper Text or Error Text */}
      {!!(helperText || errorText) && (
        <StyledText
          selectable={false}
          style={[
            styles.helperText,
            hasError && styles.errorText,
          ]}
        >
          {errorText || helperText}
        </StyledText>
      )}
    </View>
  );
}

type ExpoTextInputProps = ComponentProps<typeof ExpoTextInput>;

/**
 * Native (iOS / Android) implementation backed by `@expo/ui`'s TextInput, which
 * bridges to SwiftUI's `TextField`/`SecureField` and Jetpack Compose's
 * `TextField`. The text buffer lives natively (via `useNativeState`), so typing
 * never round-trips through React state — eliminating the cursor flicker seen on
 * controlled RN inputs.
 *
 * By design (reliability over feature-parity) this path renders the field plus
 * sibling label / helper / error text only. The in-field overlays from the web
 * implementation — password visibility toggle, clear button, left/right
 * elements, and error icon — are intentionally omitted on native to avoid
 * layering RN views over the native host view.
 */
function NativeTextInput({
  variant = "outline",
  size = "md",
  label,
  helperText,
  errorText,
  error,
  required,
  rows,
  forceLight,
  inputMode,
  onChangeText,
  onFocus,
  onBlur,
  value,
  defaultValue,
  editable = true,
  multiline,
  secureTextEntry,
  showSecureEntryToggle,
  ref,
  wrapperStyle,
  // Web-only affordances. Destructured out of `rest` so they're NOT forwarded to
  // the native field; intentionally unused on this path (see doc comment above).
  // `style` (an RN TextStyle) is likewise dropped — it doesn't map to
  // UniversalStyle and is replaced by the `boxStyle`/`textStyle` computed below.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  leftElement, rightElement, clearable, focusedStyle, style,
  ...rest
}: TextInputCustomProps) {
  const { theme, getContrastingColor } = useTheme();
  const styles = useMemo(() => createStyles(theme, variant, size), [theme, variant, size]);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const hasError = error || !!errorText;
  const sizeConfig = SIZE_CONFIGS[size];

  // Password visibility toggle. Flipping `secureTextEntry` swaps SwiftUI's
  // SecureField <-> TextField on iOS and toggles Compose's visualTransformation
  // on Android; both bind the same `state` observable, so the text survives.
  const hasSecureToggle = !!(secureTextEntry && showSecureEntryToggle);
  const effectiveSecureTextEntry = secureTextEntry && !passwordVisible;

  // Native text buffer. Seeded once; `value` changes are reconciled below.
  const state = useNativeState<string>(value ?? defaultValue ?? "");

  // Reconcile controlled `value` -> native buffer WITHOUT echoing keystrokes.
  // Only write when the parent's value genuinely diverges (resets, clears,
  // programmatic sets); typing already updated `state` natively.
  useEffect(() => {
    if (value !== undefined && value !== state.value) {
      state.value = value;
    }
  }, [value, state]);

  // The inner ref is the @expo/ui handle; the outward ref is typed as
  // RNTextInput because that's what the public TextInputCustomProps declares.
  // We expose the subset consumers use, plus a `setNativeProps` shim so the
  // uncontrolled AuthTextField can push corrected text into the native buffer.
  const innerRef = useRef<ExpoTextInputRef>(null);
  const surfaceRef = useRef<View>(null);
  const isFocusedRef = useRef(false);
  const focusRegistryToken = useMemo<KeyboardFocusedInputToken>(() => ({}), []);

  const syncFocusedInputLayout = useCallback(() => {
    if (!isFocusedRef.current) return;

    surfaceRef.current?.measureInWindow((absoluteX, absoluteY, width, height) => {
      if (!isFocusedRef.current) return;

      setKeyboardFocusedInputLayout(focusRegistryToken, {
        x: 0,
        y: 0,
        width,
        height,
        absoluteX,
        absoluteY,
      });
    });
  }, [focusRegistryToken]);

  const handleFocus = useCallback<NonNullable<ExpoTextInputProps["onFocus"]>>(
    () => {
      isFocusedRef.current = true;
      syncFocusedInputLayout();
      (onFocus as (() => void) | undefined)?.();
    },
    [onFocus, syncFocusedInputLayout]
  );

  const handleBlur = useCallback<NonNullable<ExpoTextInputProps["onBlur"]>>(
    () => {
      isFocusedRef.current = false;
      clearKeyboardFocusedInputLayout(focusRegistryToken);
      (onBlur as (() => void) | undefined)?.();
    },
    [focusRegistryToken, onBlur]
  );

  useEffect(() => {
    return () => clearKeyboardFocusedInputLayout(focusRegistryToken);
  }, [focusRegistryToken]);

  useImperativeHandle(ref, () => ({
    focus: () => innerRef.current?.focus(),
    blur: () => innerRef.current?.blur(),
    clear: () => {
      state.value = "";
    },
    isFocused: () => innerRef.current?.isFocused() ?? false,
    setNativeProps: (props: { text?: string }) => {
      if (typeof props?.text === "string") {
        state.value = props.text;
      }
    },
  }) as unknown as RNTextInput, [state]);

  const backgroundColor = forceLight
    ? palette.white
    : variant === "filled"
      ? theme.colors.card
      : "transparent";

  const borderColor = hasError
    ? theme.colors.destructive
    : forceLight
      ? "#d1d5db"
      : theme.colors.input;

  const textColor = forceLight
    ? "#1f2937"
    : getContrastingColor(
      backgroundColor === "transparent" ? theme.colors.background : backgroundColor,
      theme.colors.text,
      palette.white
    );

  // The rounded surface (fill + border + radius) lives on the RN wrapper View,
  // NOT on the native field. On the New Architecture (Fabric), @expo/ui's host
  // paints `backgroundColor` as an un-clipped rect and strokes the rounded border
  // on top, so a fill handed to the host leaks square corners past the stroke.
  // Letting the RN View own the surface (with `overflow: "hidden"`) keeps the
  // fill clipped to `borderRadius`; the native host sits transparent inside it.
  const surfaceStyle: ViewStyle = {
    backgroundColor,
    borderColor,
    borderRadius: variant === "underlined" ? 0 : spacing.radiusMd,
    borderWidth: variant === "outline" ? 1 : 0,
    opacity: editable === false ? 0.6 : 1,
    overflow: "hidden",
  };

  // Native field: transparent, padding only. The visible surface is drawn by
  // `surfaceStyle` on the wrapper above.
  //
  // Single-line height comes from symmetric vertical padding, NOT a fixed
  // `height`. Forcing a height made Android pin the text to the top of the box
  // (Compose's decoration box uses `contentAlignment = topStart`), leaving a
  // bottom-heavy gap; iOS centered fine. Letting padding define the height keeps
  // the text vertically centered on both platforms while matching the previous
  // visual size (≈ `sizeConfig.height`). Multiline is left to grow naturally.
  const boxStyle: ExpoTextInputProps["style"] = {
    backgroundColor: "transparent",
    paddingHorizontal: sizeConfig.paddingHorizontal,
    paddingVertical: multiline
      ? sizeConfig.paddingVertical
      : sizeConfig.nativePaddingVertical,
  };

  // "System" is an RN-only sentinel (RCTFont resolves it to the system font).
  // @expo/ui passes the family verbatim to SwiftUI's Font.custom / Compose,
  // where no such font exists — the fallback ignores fontSize and renders at
  // the 17pt default, blowing up text and secure-entry dots. Omit the family
  // so the native side uses the system font at our requested size.
  const nativeFontFamily =
    fontFamilies.sansSerif.regular === "System"
      ? undefined
      : fontFamilies.sansSerif.regular;

  const textStyle: ExpoTextInputProps["textStyle"] = {
    color: textColor,
    fontSize: sizeConfig.fontSize,
    ...(nativeFontFamily ? { fontFamily: nativeFontFamily } : null),
  };

  return (
    <View style={wrapperStyle}>
      {!!label && (
        <View style={styles.labelContainer}>
          <StyledText selectable={false} style={styles.label}>
            {label}
            {required && <StyledText selectable={false} style={styles.required}> *</StyledText>}
          </StyledText>
        </View>
      )}

      {/*
        Rounded surface owns fill + border + radius and clips with overflow:hidden
        (see `surfaceStyle`). Field + optional password toggle are laid out inside
        it as a flex Row; the eye button is a SIBLING of the native Host — never
        layered over it — which avoids the RN-view-over-Host mis-measurement that
        bit other native components, and keeps the eye inside the rounded surface.
      */}
      <View
        ref={surfaceRef}
        style={[surfaceStyle, hasSecureToggle && styles.nativeRow]}
        onLayout={syncFocusedInputLayout}
      >
        {/*
          The universal @expo/ui TextInput renders a raw SwiftUI / Compose view and
          MUST be wrapped in <Host>, or iOS throws "a SwiftUI view is being mounted
          inside a standard UIView". matchContents vertical lets the host fill width
          via normal RN layout while sizing its height to the native field.
        */}
        <Host
          matchContents={{ vertical: true }}
          style={hasSecureToggle ? styles.nativeHostFlex : styles.nativeHost}
        >
          <ExpoTextInput
            {...(rest as ExpoTextInputProps)}
            ref={innerRef}
            value={state}
            defaultValue={defaultValue}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={editable}
            multiline={multiline}
            rows={rows}
            inputMode={inputMode}
            secureTextEntry={effectiveSecureTextEntry}
            placeholderTextColor={theme.colors.textDim}
            style={boxStyle}
            textStyle={textStyle}
          />
        </Host>

        {hasSecureToggle && (
          <Pressable
            style={styles.nativePasswordToggle}
            onPress={() => setPasswordVisible((v) => !v)}
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <Icon
              name={passwordVisible ? "eye-off" : "eye"}
              size={spacing.iconSm + 4}
              color="textDim"
            />
          </Pressable>
        )}
      </View>

      {!!(helperText || errorText) && (
        <StyledText
          selectable={false}
          style={[styles.helperText, hasError && styles.errorText]}
        >
          {errorText || helperText}
        </StyledText>
      )}
    </View>
  );
}

const createStyles = (theme: Theme, variant: TextInputVariant, size: TextInputSize) =>
  StyleSheet.create({
    nativeHost: {
      width: "100%",
    },
    nativeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    nativeHostFlex: {
      flex: 1,
    },
    nativePasswordToggle: {
      paddingHorizontal: spacing.xs,
    },
    wrapper: {
      width: "100%",
      position: "relative",
      backgroundColor: "transparent",
      borderRadius: variant === "underlined" ? 0 : spacing.radiusMd,
      justifyContent: "center",
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
      borderColor: theme.colors.destructive,
    },
    labelContainer: {
      flexDirection: "row",
      marginBottom: spacing.xs,
    },
    label: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontWeight: "500" as const,
      fontSize: 14,
      color: theme.colors.text,
    },
    required: {
      color: theme.colors.destructive,
      fontFamily: fontFamilies.sansSerif.bold,
    },
    helperText: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: 12,
      color: theme.colors.textDim,
      marginTop: spacing.xs,
    },
    errorText: {
      color: theme.colors.destructive,
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
    errorIcon: {
      position: "absolute",
      right: spacing.sm,
      top: "50%",
      transform: [{ translateY: -10 }],
      zIndex: 1,
    },
    clearButton: {
      position: "absolute",
      right: spacing.sm,
      top: "50%",
      transform: [{ translateY: Platform.OS === "web" ? -10 : -12 }],
      zIndex: 1,
      ...(Platform.OS === "web" && { cursor: "pointer" as any }),
    },
    rightElements: {
      position: "absolute",
      right: spacing.sm,
      top: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      zIndex: 1,
    },
  });
