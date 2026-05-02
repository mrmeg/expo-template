import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { StyledText } from "./StyledText";
import type { Theme } from "../constants/colors";

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
  const textStyle = [
    styles.text,
    variant === "default" && { color: theme.colors.primaryForeground },
    variant === "secondary" && { color: theme.colors.secondaryForeground },
    variant === "outline" && { color: theme.colors.foreground },
    variant === "destructive" && { color: theme.colors.destructiveForeground },
  ];
  const normalizedChildren = React.Children.toArray(children);
  const hasOnlyTextChildren = normalizedChildren.every(
    (child) => typeof child === "string" || typeof child === "number",
  );
  const content = hasOnlyTextChildren ? (
    <StyledText style={textStyle}>{normalizedChildren.join("")}</StyledText>
  ) : (
    React.Children.map(children, (child) => {
      if (typeof child === "string" || typeof child === "number") {
        return <StyledText style={textStyle}>{child}</StyledText>;
      }

      return child;
    })
  );

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.badge,
        variant === "default" && styles.default,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        variant === "destructive" && styles.destructive,
        styleOverride,
      ]}
    >
      {content}
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
