import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { StyledText } from "./StyledText";
import type { Theme } from "@/client/constants/colors";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Badge Component
 *
 * Small inline status label with pill shape.
 *
 * Usage:
 * ```tsx
 * <Badge>Default</Badge>
 * <Badge variant="secondary">Secondary</Badge>
 * <Badge variant="outline">Outline</Badge>
 * <Badge variant="destructive">Error</Badge>
 * ```
 */
function Badge({ children, variant = "default", style: styleOverride }: BadgeProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.badge,
        variant === "default" && styles.default,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        variant === "destructive" && styles.destructive,
        styleOverride,
      ]}
    >
      {typeof children === "string" ? (
        <StyledText
          style={[
            styles.text,
            variant === "default" && { color: theme.colors.primaryForeground },
            variant === "secondary" && { color: theme.colors.secondaryForeground },
            variant === "outline" && { color: theme.colors.foreground },
            variant === "destructive" && { color: theme.colors.destructiveForeground },
          ]}
        >
          {children}
        </StyledText>
      ) : (
        children
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      alignSelf: "flex-start",
      borderRadius: spacing.radiusFull,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    default: {
      backgroundColor: theme.colors.primary,
    },
    secondary: {
      backgroundColor: theme.colors.secondary,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    destructive: {
      backgroundColor: theme.colors.destructive,
    },
    text: {
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 18,
    },
  });

export { Badge };
