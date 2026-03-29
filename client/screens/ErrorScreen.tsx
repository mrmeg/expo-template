import React from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { useStaggeredEntrance, STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import type { Theme } from "@/client/constants/colors";

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
  const styles = createStyles(theme);

  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedIcon = icon ?? defaults.icon;
  const resolvedTitle = title ?? defaults.title;
  const resolvedDescription = description ?? defaults.description;

  // Staggered entrance animations
  const iconEntrance = useStaggeredEntrance({ type: "scale", delay: 0 });
  const titleEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY });
  const descEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 2 });
  const actionsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 3 });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, styleOverride]}>
      {/* Top spacer */}
      <View style={styles.spacer} />

      {/* Icon */}
      <Animated.View style={[styles.center, iconEntrance]}>
        <View style={styles.iconCircle}>
          <Icon name={resolvedIcon} size={48} color="mutedForeground" decorative />
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View style={[styles.center, titleEntrance]}>
        <SansSerifBoldText style={styles.title}>
          {resolvedTitle}
        </SansSerifBoldText>
      </Animated.View>

      {/* Description */}
      <Animated.View style={[styles.center, descEntrance]}>
        <SansSerifText style={styles.description}>
          {resolvedDescription}
        </SansSerifText>
        {variant === "maintenance" && estimatedReturn && (
          <SansSerifText style={styles.estimatedReturn}>
            {estimatedReturn}
          </SansSerifText>
        )}
      </Animated.View>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <Animated.View style={[styles.actions, actionsEntrance]}>
          {primaryAction && (
            <Button onPress={primaryAction.onPress}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button preset="ghost" onPress={secondaryAction.onPress}>
              {secondaryAction.label}
            </Button>
          )}
        </Animated.View>
      )}

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
    center: {
      alignItems: "center",
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 22,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      maxWidth: 300,
    },
    estimatedReturn: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    actions: {
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
  });
}
