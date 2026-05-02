import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { SansSerifBoldText, SansSerifText } from "./StyledText";
import { Button, type ButtonProps } from "./Button";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import type { Theme } from "../constants/colors";

export interface EmptyStateProps {
  /** Icon name to display */
  icon?: IconName;
  /** Icon size in pixels */
  iconSize?: number;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** CTA button label */
  actionLabel?: string;
  /** CTA button press handler */
  onAction?: () => void;
  /** Button preset variant */
  actionPreset?: ButtonProps["preset"];
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
  /** Custom children below description / above action */
  children?: React.ReactNode;
}

/**
 * EmptyState Component
 *
 * Displays a centered placeholder for empty lists, search results,
 * or blank screens. Works well as FlatList's ListEmptyComponent.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon="inbox"
 *   title="No messages"
 *   description="You don't have any messages yet."
 *   actionLabel="Compose"
 *   onAction={() => router.push("/compose")}
 * />
 * ```
 */
export function EmptyState({
  icon,
  iconSize = 48,
  title,
  description,
  actionLabel,
  onAction,
  actionPreset = "default",
  style,
  children,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {!!icon && (
        <View style={styles.iconWrapper}>
          <Icon name={icon} size={iconSize} color={theme.colors.mutedForeground} />
        </View>
      )}

      <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>

      {!!description && (
        <SansSerifText style={styles.description}>{description}</SansSerifText>
      )}

      {children}

      {!!actionLabel && onAction && (
        <Button
          preset={actionPreset}
          onPress={onAction}
          style={styles.action}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    iconWrapper: {
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      lineHeight: 24,
      color: theme.colors.foreground,
      textAlign: "center",
      letterSpacing: -0.3,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.sm,
      maxWidth: 280,
    },
    action: {
      marginTop: spacing.lg,
    },
  });
