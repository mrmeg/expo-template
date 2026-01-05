import { StyleSheet, StyleProp, TextStyle, Platform } from "react-native";
import * as LabelPrimitive from "@rn-primitives/label";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import { StyledText } from "./StyledText";
import type { Theme } from "@/client/constants/colors";

export interface LabelProps {
  /**
   * The label text
   */
  children: string;
  /**
   * Native ID to associate with a form control
   */
  nativeID?: string;
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
 * Provides accessible labeling for form controls with automatic
 * association via nativeID.
 *
 * Usage:
 * ```tsx
 * // Basic label
 * <Label nativeID="email-input">Email</Label>
 * <TextInput nativeID="email-input" />
 *
 * // Required field
 * <Label nativeID="password" required>Password</Label>
 *
 * // With error state
 * <Label nativeID="username" error>Username</Label>
 *
 * // With press handler to focus input
 * <Label nativeID="search" onPress={() => inputRef.current?.focus()}>
 *   Search
 * </Label>
 * ```
 */
export function Label({
  children,
  nativeID,
  required,
  size = "md",
  error,
  disabled,
  style,
  onPress,
}: LabelProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const sizeConfig = SIZE_CONFIGS[size];

  return (
    <LabelPrimitive.Root
      nativeID={nativeID}
      onPress={onPress}
      style={{
        ...styles.root,
        ...(Platform.OS === "web" && onPress && { cursor: "pointer" as any }),
      }}
    >
      <LabelPrimitive.Text
        style={[
          styles.label,
          { fontSize: sizeConfig.fontSize },
          error && styles.errorLabel,
          disabled && styles.disabledLabel,
          style,
        ]}
      >
        {children}
        {required && <StyledText style={styles.required}> *</StyledText>}
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
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.text,
    },
    required: {
      color: theme.colors.destructive,
      fontFamily: fontFamilies.sansSerif.bold,
    },
    errorLabel: {
      color: theme.colors.destructive,
    },
    disabledLabel: {
      opacity: 0.6,
    },
  });
