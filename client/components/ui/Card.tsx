import React from "react";
import { View, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import { StyledText, TextProps } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";

/**
 * Card Component
 *
 * A themed container component with header, content, and footer sections.
 * Follows shadcn/ui patterns with consistent styling and theme integration.
 *
 * Usage:
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card description text</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <Text>Main content goes here</Text>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */

export interface CardProps {
  /** Card contents */
  children?: React.ReactNode;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
  /** Visual variant */
  variant?: "default" | "outline" | "ghost";
}

function Card({ children, style: styleOverride, variant = "default" }: CardProps) {
  const { theme } = useTheme();
  const styles = createCardStyles(theme);

  return (
    <View
      style={[
        styles.card,
        variant === "default" && styles.cardDefault,
        variant === "outline" && styles.cardOutline,
        variant === "ghost" && styles.cardGhost,
        styleOverride,
      ]}
    >
      {children}
    </View>
  );
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function CardHeader({ children, style: styleOverride }: CardHeaderProps) {
  const styles = createCardStyles(useTheme().theme);

  return (
    <View style={[styles.header, styleOverride]}>
      {children}
    </View>
  );
}

export interface CardContentProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function CardContent({ children, style: styleOverride }: CardContentProps) {
  const styles = createCardStyles(useTheme().theme);

  return (
    <View style={[styles.content, styleOverride]}>
      {children}
    </View>
  );
}

export interface CardFooterProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function CardFooter({ children, style: styleOverride }: CardFooterProps) {
  const styles = createCardStyles(useTheme().theme);

  return (
    <View style={[styles.footer, styleOverride]}>
      {children}
    </View>
  );
}

export interface CardTitleProps extends Omit<TextProps, "style"> {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

function CardTitle({ children, style: styleOverride, ...props }: CardTitleProps) {
  const { theme } = useTheme();
  const styles = createCardStyles(theme);

  return (
    <StyledText
      fontWeight="semibold"
      {...props}
      style={[styles.title, { color: theme.colors.text }, styleOverride]}
    >
      {children}
    </StyledText>
  );
}

export interface CardDescriptionProps extends Omit<TextProps, "style"> {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

function CardDescription({ children, style: styleOverride, ...props }: CardDescriptionProps) {
  const { theme } = useTheme();
  const styles = createCardStyles(theme);

  return (
    <StyledText
      {...props}
      style={[styles.description, { color: theme.colors.textDim }, styleOverride]}
    >
      {children}
    </StyledText>
  );
}

const createCardStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: spacing.radiusLg,
      overflow: "hidden",
    } as ViewStyle,
    cardDefault: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    } as ViewStyle,
    cardOutline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.border,
    } as ViewStyle,
    cardGhost: {
      backgroundColor: "transparent",
    } as ViewStyle,
    header: {
      padding: spacing.lg,
      paddingBottom: spacing.xs,
      gap: spacing.xs,
    } as ViewStyle,
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    } as ViewStyle,
    footer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: 0,
    } as ViewStyle,
    title: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.3,
    } as TextStyle,
    description: {
      fontSize: 14,
      lineHeight: 20,
    } as TextStyle,
  });

export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription };
