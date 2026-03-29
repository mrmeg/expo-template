import React from "react";
import { StyleSheet } from "react-native";
import { StyledText } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";

interface FormMessageProps {
  /** Error message to display. Renders nothing when undefined/empty. */
  message?: string;
}

/**
 * Displays a form field error message matching TextInput's errorText styling.
 *
 * Usage:
 * ```tsx
 * <FormMessage message={fieldState.error?.message} />
 * ```
 */
export function FormMessage({ message }: FormMessageProps) {
  const { theme } = useTheme();

  if (!message) return null;

  return (
    <StyledText
      style={[
        styles.message,
        { color: theme.colors.destructive },
      ]}
    >
      {message}
    </StyledText>
  );
}

const styles = StyleSheet.create({
  message: {
    fontFamily: fontFamilies.sansSerif.regular,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
