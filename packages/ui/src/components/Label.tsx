import { StyleSheet, StyleProp, TextStyle, Platform } from "react-native";
import * as LabelPrimitive from "@rn-primitives/label";
import { useTheme } from "../hooks/useTheme";
import { useFontStyle } from "../hooks/useFontStyle";
import { spacing } from "../constants/spacing";
import { StyledText } from "./StyledText";
import { createThemedStyles } from "../lib/themedStyles";
import type { Theme } from "../constants/colors";

export interface LabelProps {
  /**
   * The label text
   */
  children: string;
  /**
   * The label's OWN id. On web react-native-web maps it to `id`; on native it
   * is the `nativeID` a control's `accessibilityLabelledBy` can point at.
   *
   * Must differ from the paired input's id — see `htmlFor`.
   */
  nativeID?: string;
  /**
   * WEB ONLY — the id of the input this label describes (the input's
   * `nativeID`). Passing it makes `@rn-primitives/label` render a real
   * `<label for="…">`, which is what associates the two and makes clicking the
   * label focus the input. No-op on native, where association goes the other
   * way (the control points at the label's `nativeID`).
   */
  htmlFor?: string;
  /**
   * Whether the field is required (shows asterisk)
   */
  required?: boolean;
  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether the label is in an error state
   */
  error?: boolean;
  /**
   * Whether the label is disabled
   */
  disabled?: boolean;
  /**
   * Optional style override for the text
   */
  style?: StyleProp<TextStyle>;
  /**
   * Press handler (useful for focusing associated input)
   */
  onPress?: () => void;
}

const SIZE_CONFIGS = {
  sm: { fontSize: 12 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
};

/**
 * Label component for form fields using @rn-primitives/label
 *
 * Accessible labeling for form controls. Association needs **two distinct
 * ids**: `nativeID` is the label's own id, `htmlFor` is the input's id. Giving
 * both the same value renders two elements with one id on web and associates
 * nothing.
 *
 * Usage:
 * ```tsx
 * // Paired with an input. `htmlFor` (web) makes this a real <label for>, so
 * // clicking it focuses the input; `nativeID` names the label itself, which is
 * // what a control's `accessibilityLabelledBy` points at on native.
 * <Label nativeID="email-label" htmlFor="email-input">Email</Label>
 * <TextInput nativeID="email-input" />
 *
 * // Required field
 * <Label nativeID="password-label" htmlFor="password-input" required>Password</Label>
 * <TextInput nativeID="password-input" secureTextEntry />
 *
 * // With error state
 * <Label nativeID="username-label" htmlFor="username-input" error>Username</Label>
 *
 * // Standalone caption with no control to associate — omit htmlFor
 * <Label>Filters</Label>
 *
 * // With press handler to focus input (needed on native, where htmlFor is a
 * // no-op and pressing the label does nothing on its own)
 * <Label nativeID="search-label" htmlFor="search-input" onPress={() => inputRef.current?.focus()}>
 *   Search
 * </Label>
 * ```
 */
export function Label({
  children,
  nativeID,
  htmlFor,
  required,
  size = "md",
  error,
  disabled,
  style,
  onPress,
}: LabelProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const sizeConfig = SIZE_CONFIGS[size];
  // Resolved through the theme store so `setFonts` overrides apply; identical
  // to the old hardcoded medium family when no override is set.
  const labelFont = useFontStyle("medium");
  const textStyle = StyleSheet.flatten([
    styles.label,
    labelFont,
    { fontSize: sizeConfig.fontSize },
    error && styles.errorLabel,
    disabled && styles.disabledLabel,
    style,
  ]);

  return (
    <LabelPrimitive.Root
      nativeID={nativeID}
      onPress={onPress}
      style={{
        ...styles.root,
        ...(Platform.OS === "web" && onPress && { cursor: "pointer" as any }),
      }}
    >
      {/*
        `htmlFor` belongs on Text, not Root: it's declared on the primitive's
        TextProps, and the web build is the piece that consumes it (it drops
        Radix's `asChild` so a real <label for> element wraps the text). Root
        keeps `nativeID` so the label's own id lands once, on the wrapper.
      */}
      <LabelPrimitive.Text
        htmlFor={htmlFor}
        style={textStyle}
      >
        {children}
        {required && <StyledText selectable={false} fontWeight="bold" style={styles.required}> *</StyledText>}
      </LabelPrimitive.Text>
    </LabelPrimitive.Root>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      marginBottom: spacing.xs,
    },
    label: {
      // Medium weight — the fontFamily (+ numeric fontWeight on web) is
      // resolved per-render through the theme store (`useFontStyle("medium")`
      // in Label) so `setFonts` overrides apply here too.
      color: theme.colors.text,
      userSelect: "none",
    },
    required: {
      // Bold weight comes from the StyledText `fontWeight="bold"` prop, which
      // resolves the family through the theme store.
      color: theme.colors.destructive,
      userSelect: "none",
    },
    errorLabel: {
      color: theme.colors.destructive,
    },
    disabledLabel: {
      opacity: 0.6,
    },
  });

const themedStyles = createThemedStyles(createStyles);
