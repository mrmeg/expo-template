import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useDimensions, useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Card } from "@mrmeg/expo-ui/components/Card";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CtaBannerBlockProps {
  /** Banner headline. */
  title?: string;
  /** Supporting copy below the headline. */
  description?: string;
  /** CTA button label. */
  actionLabel?: string;
  /** CTA press handler. */
  onAction?: () => void;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CtaBannerBlock
 *
 * Accent-bordered `Card` with copy on one side and a single `Button` on the
 * other; stacks to a column on phones. The row/column decision comes from
 * `useDimensions()` (seeded for the export-time prerender) rather than raw
 * `useWindowDimensions()`, so the exported HTML shell and the client's first
 * render agree on the breakpoint.
 *
 * @example
 * ```tsx
 * <CtaBannerBlock
 *   title="Ready when you are"
 *   description="Start from a template or compose your own from blocks."
 *   actionLabel="Create a screen"
 *   onAction={() => router.push("/new")}
 * />
 * ```
 */
export function CtaBannerBlock({
  title = "Ready when you are",
  description = "Start from a template or compose your own from blocks.",
  actionLabel = "Create a screen",
  onAction,
  style: styleOverride,
}: CtaBannerBlockProps) {
  const { theme } = useTheme();
  const { isSmallScreen } = useDimensions();
  const styles = themedStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <Card variant="outline" style={styles.card}>
        <View style={[styles.body, isSmallScreen ? styles.bodyStacked : styles.bodyRow]}>
          <View style={[styles.copy, !isSmallScreen && styles.copyRow]}>
            <SansSerifBoldText size="lg">{title}</SansSerifBoldText>
            {!!description && (
              <SansSerifText size="sm" style={styles.description}>
                {description}
              </SansSerifText>
            )}
          </View>

          {!!actionLabel && <Button onPress={onAction} text={actionLabel} />}
        </View>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Module scope, not render time: theme-dependent styles created during render
// miss the stylesheet snapshot baked into the exported HTML, so the shell
// paints unstyled until the client re-inserts the rules.
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    card: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.muted,
    },
    body: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    bodyRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    bodyStacked: {
      flexDirection: "column",
      alignItems: "flex-start",
    },
    copy: {
      flexShrink: 1,
      gap: spacing.xxs,
    },
    // In the row layout the copy takes the leftover width so the button sits
    // flush right; stacked, it stays content-width.
    copyRow: {
      flex: 1,
    },
    description: {
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
