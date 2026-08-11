import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, type DimensionValue } from "react-native";
import { useDimensions, useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Card } from "@mrmeg/expo-ui/components/Card";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureGridItem {
  icon: IconName;
  title: string;
  description: string;
}

export interface FeatureGridBlockProps {
  /** Feature cards, rendered in order. */
  items?: FeatureGridItem[];
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ITEMS: FeatureGridItem[] = [
  {
    icon: "droplet",
    title: "Themed by default",
    description: "Every block reads the active theme — swap palettes without touching a block.",
  },
  {
    icon: "smartphone",
    title: "Native + web",
    description: "One source renders to iOS, Android, and SSR-safe web output.",
  },
  {
    icon: "list",
    title: "Recipe included",
    description: "Each block documents the components it composes, so it teaches as it ships.",
  },
  {
    icon: "copy",
    title: "Copy, don't import",
    description: "Blocks are open code — copy the folder and make it yours.",
  },
  {
    icon: "grid",
    title: "Registry-driven",
    description: "gen:blocks scans meta files and writes the registry; no hand-editing.",
  },
  {
    icon: "search",
    title: "Searchable",
    description: "Blocks surface in the same index as components and templates.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FeatureGridBlock
 *
 * Icon + title + copy cards in a responsive grid: one column on phones, two
 * on mid-width, three on wide viewports. Column count comes from
 * `useDimensions()` (seeded for the export-time prerender) rather than
 * `useWindowDimensions()`, and the per-card width is an inline `flexBasis` so
 * the value always ships in the exported HTML shell, which the client's first
 * render must match.
 *
 * @example
 * ```tsx
 * <FeatureGridBlock
 *   items={[{ icon: "zap", title: "Fast", description: "Ships in an afternoon." }]}
 * />
 * ```
 */
export function FeatureGridBlock({ items = DEFAULT_ITEMS, style: styleOverride }: FeatureGridBlockProps) {
  const { theme } = useTheme();
  const { isSmallScreen, isMediumScreen } = useDimensions();
  const styles = themedStyles(theme);

  const columns = isSmallScreen ? 1 : isMediumScreen ? 2 : 3;
  // Percentage basis rather than a measured pixel width: no onLayout pass, and
  // the subtraction keeps `columns` cards plus their gaps inside one row.
  const cardBasis: DimensionValue = `${100 / columns - (columns > 1 ? 2 : 0)}%`;

  return (
    <View style={[styles.container, styleOverride]}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Card key={item.title} style={[styles.card, { flexBasis: cardBasis }]}>
            <View style={styles.cardBody}>
              <View style={styles.iconWrap}>
                <Icon name={item.icon} size={spacing.iconSm} color={theme.colors.accent} decorative />
              </View>
              <SansSerifBoldText size="base">{item.title}</SansSerifBoldText>
              <SansSerifText size="sm" style={styles.description}>
                {item.description}
              </SansSerifText>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ICON_WRAP_SIZE = 32;

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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    card: {
      flexGrow: 1,
    },
    cardBody: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    iconWrap: {
      width: ICON_WRAP_SIZE,
      height: ICON_WRAP_SIZE,
      borderRadius: spacing.radiusSm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.muted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.accent,
      marginBottom: spacing.xs,
    },
    description: {
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
