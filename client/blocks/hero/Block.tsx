import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeroBlockAction {
  label: string;
  onPress?: () => void;
}

export interface HeroBlockProps {
  /** Small uppercase label rendered above the headline. */
  eyebrow?: string;
  /** Headline, rendered at title size. */
  title?: string;
  /** Supporting copy below the headline. */
  description?: string;
  /** Primary CTA, rendered as the filled button. */
  primaryAction?: HeroBlockAction | null;
  /** Secondary CTA, rendered as an outline button beside the primary one. */
  secondaryAction?: HeroBlockAction | null;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeroBlock
 *
 * Marketing hero *section*: eyebrow -> headline -> width-constrained copy ->
 * paired CTAs, centered. Extracted from the hero template's `centered`
 * variant, minus the screen-level concerns (no `flex: 1`, no safe-area
 * insets) — a block is one section of a screen, so it sizes to its content
 * and lets the host screen own the scroll container and edge insets.
 *
 * Every prop has a default so the block previews with no configuration.
 *
 * @example
 * ```tsx
 * <HeroBlock
 *   eyebrow="Launch week"
 *   title="Ship your next screen in an afternoon"
 *   description="Eyebrow, headline, supporting copy, and paired actions."
 *   primaryAction={{ label: "Get started", onPress: () => router.push("/signup") }}
 *   secondaryAction={{ label: "See the docs", onPress: () => openDocs() }}
 * />
 * ```
 */
export function HeroBlock({
  eyebrow = "Launch week",
  title = "Ship your next screen in an afternoon",
  description = "Eyebrow, headline, supporting copy, and paired actions — the marketing hero, reduced to a section you can drop into any screen.",
  primaryAction = { label: "Get started" },
  secondaryAction = { label: "See the docs" },
  style: styleOverride,
}: HeroBlockProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <SectionHeader
        align="center"
        eyebrow={eyebrow}
        title={title}
        description={description}
        style={styles.header}
      />

      {!!(primaryAction || secondaryAction) && (
        <View style={styles.actions}>
          {!!primaryAction && (
            <Button size="lg" onPress={primaryAction.onPress} text={primaryAction.label} />
          )}
          {!!secondaryAction && (
            <Button
              preset="outline"
              size="lg"
              onPress={secondaryAction.onPress}
              text={secondaryAction.label}
            />
          )}
        </View>
      )}
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
      alignItems: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      gap: spacing.lg,
    },
    header: {
      maxWidth: 560,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
    },
  });

const themedStyles = createThemedStyles(createStyles);
