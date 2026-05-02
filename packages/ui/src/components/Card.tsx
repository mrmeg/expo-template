import React, { createContext, useContext } from "react";
import { View, Pressable, StyleSheet, ViewStyle, TextStyle, StyleProp, Platform } from "react-native";
import Animated from "react-native-reanimated";
import { StyledText, TextProps } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { useScalePress } from "../hooks/useScalePress";
import { spacing } from "../constants/spacing";
import type { Theme } from "../constants/colors";

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

const CardContext = createContext<{ theme: Theme; styles: ReturnType<typeof createCardStyles> } | null>(null);

function useCardContext() {
  const ctx = useContext(CardContext);
  if (!ctx) {
    // Fallback for standalone usage without Card parent
    const { theme } = useTheme();
    return { theme, styles: createCardStyles(theme) };
  }
  return ctx;
}

export interface CardProps {
  /** Card contents */
  children?: React.ReactNode;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
  /** Visual variant */
  variant?: "default" | "outline" | "ghost";
  /** Make card pressable with scale animation */
  onPress?: () => void;
  /** Whether the card is disabled (only relevant when onPress is set) */
  disabled?: boolean;
}

function Card({ children, style: styleOverride, variant = "default", onPress, disabled }: CardProps) {
  const { theme } = useTheme();
  const styles = createCardStyles(theme);
  const ctx = { theme, styles };
  const { animatedStyle: scaleStyle, pressHandlers } = useScalePress({
    disabled: !onPress || !!disabled,
    scaleTo: 0.98,
    haptic: false,
  });

  const cardContent = (
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

  if (onPress) {
    return (
      <CardContext.Provider value={ctx}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!disabled }}
          {...pressHandlers}
          style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
        >
          <Animated.View style={scaleStyle}>
            {cardContent}
          </Animated.View>
        </Pressable>
      </CardContext.Provider>
    );
  }

  return (
    <CardContext.Provider value={ctx}>
      {cardContent}
    </CardContext.Provider>
  );
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function CardHeader({ children, style: styleOverride }: CardHeaderProps) {
  const { styles } = useCardContext();

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
  const { styles } = useCardContext();

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
  const { styles } = useCardContext();

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
  const { theme, styles } = useCardContext();

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
  const { theme, styles } = useCardContext();

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
