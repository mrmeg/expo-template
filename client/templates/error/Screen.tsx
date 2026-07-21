import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useStaggeredEntrance, STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import type { IconName } from "@mrmeg/expo-ui/components/Icon";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorVariant = "not-found" | "offline" | "maintenance" | "permission-denied" | "generic";

export interface ErrorScreenAction {
  label: string;
  onPress: () => void;
}

export interface ErrorScreenProps {
  /** Error variant controlling default icon, title, and description */
  variant?: ErrorVariant;
  /** Override the variant's default icon */
  icon?: IconName;
  /** Override the variant's default title */
  title?: string;
  /** Override the variant's default description */
  description?: string;
  /** Primary action button (e.g. Retry, Go back) */
  primaryAction?: ErrorScreenAction;
  /** Secondary action button (e.g. Go home, Request access) */
  secondaryAction?: ErrorScreenAction;
  /** Shown below description for "maintenance" variant (e.g. "Back by 3:00 PM EST") */
  estimatedReturn?: string;
  /** Container style override */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variant defaults
// ---------------------------------------------------------------------------

const VARIANT_DEFAULTS: Record<ErrorVariant, { icon: IconName; title: string; description: string }> = {
  "not-found": {
    icon: "search",
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has been moved.",
  },
  offline: {
    icon: "wifi-off",
    title: "You're offline",
    description: "Check your internet connection and try again.",
  },
  maintenance: {
    icon: "tool",
    title: "Under maintenance",
    description: "We're making improvements. We'll be back shortly.",
  },
  "permission-denied": {
    icon: "shield-off",
    title: "Access restricted",
    description: "You don't have permission to view this page.",
  },
  generic: {
    icon: "alert-circle",
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorScreen({
  variant = "generic",
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  estimatedReturn,
  style: styleOverride,
}: ErrorScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedIcon = icon ?? defaults.icon;
  const resolvedTitle = title ?? defaults.title;
  const resolvedDescription = description ?? defaults.description;

  // Staggered entrance animations — one for the icon/title/description block
  // (rendered together via EmptyState) and one for the actions that follow.
  const contentEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: 0 });
  const actionsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 2 });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, styleOverride]}>
      {/* Top spacer */}
      <View style={styles.spacer} />

      <Animated.View style={contentEntrance}>
        <EmptyState
          icon={resolvedIcon}
          iconSize={48}
          title={resolvedTitle}
          description={resolvedDescription}
        >
          {variant === "maintenance" && estimatedReturn && (
            <SansSerifText size="sm" style={styles.estimatedReturn}>
              {estimatedReturn}
            </SansSerifText>
          )}

          {/* Actions */}
          {(primaryAction || secondaryAction) && (
            <Animated.View style={[styles.actions, actionsEntrance]}>
              {primaryAction && (
                <Button onPress={primaryAction.onPress} text={primaryAction.label} style={styles.actionButton} />
              )}
              {secondaryAction && (
                <Button preset="ghost" onPress={secondaryAction.onPress} text={secondaryAction.label} style={styles.actionButton} />
              )}
            </Animated.View>
          )}
        </EmptyState>
      </Animated.View>

      {/* Bottom spacer */}
      <View style={styles.spacer} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
    },
    spacer: {
      flex: 1,
    },
    estimatedReturn: {
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    actions: {
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    actionButton: {
      alignSelf: "center",
    },
  });
}
