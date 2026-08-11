import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { StatCard, type StatCardChange } from "@mrmeg/expo-ui/components/StatCard";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Same metric shape the `stats` and `dashboard` templates feed to `StatCard`,
 * so a screen can hand the identical array to either tier.
 */
export interface StatRowMetric {
  label: string;
  value: string | number;
  unit?: string;
  change?: StatCardChange;
}

export interface StatRowBlockProps {
  /** Optional heading above the row — omit both to render the row alone. */
  title?: string;
  description?: string;
  /** Metrics, rendered left to right and wrapping on narrow viewports. */
  stats?: StatRowMetric[];
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_STATS: StatRowMetric[] = [
  { label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.4%", direction: "up" } },
  { label: "Active users", value: "2,481", change: { value: "+8.2%", direction: "up" } },
  { label: "Churn", value: "1.9", unit: "%", change: { value: "-0.3%", direction: "down" } },
  { label: "NPS", value: "62", change: { value: "+4", direction: "up" } },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StatRowBlock
 *
 * A row of `StatCard`s with an optional `SectionHeader`. Cards use a
 * `flexBasis` two-up on phones and grow to fill wider rows, matching the grid
 * shape the `stats` and `dashboard` templates already use so the metric array
 * is interchangeable between them.
 *
 * @example
 * ```tsx
 * <StatRowBlock
 *   title="This month"
 *   stats={[{ label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.4%", direction: "up" } }]}
 * />
 * ```
 */
export function StatRowBlock({
  title = "This month",
  description,
  stats = DEFAULT_STATS,
  style: styleOverride,
}: StatRowBlockProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      {!!title && (
        <SectionHeader title={title} description={description} style={styles.header} />
      )}

      <View style={styles.row}>
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            unit={stat.unit}
            change={stat.change}
            style={styles.card}
          />
        ))}
      </View>
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
    header: {
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    // Two-up on phone: just under half a row so the gap fits without
    // overflowing. flexBasis (not width) so cards still grow to fill a wider
    // row — same treatment as client/templates/stats.
    card: {
      flexGrow: 1,
      flexBasis: "47%",
    },
  });

const themedStyles = createThemedStyles(createStyles);
