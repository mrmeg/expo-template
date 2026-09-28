import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { EyebrowText, StyledText } from "@mrmeg/expo-ui/components/StyledText";
import type { StatCardChange } from "@mrmeg/expo-ui/components/StatCard";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Same metric shape the `stats` and `dashboard` templates use, so a screen can
 * hand the identical array to either tier.
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
 * A row of flat stats with an optional `SectionHeader`: each metric is a
 * label, a tabular value, and an optional change line under a hairline rule,
 * not a card. Stats use a `flexBasis` two-up on phones and grow to fill wider
 * rows, matching the grid shape the `stats` and `dashboard` templates already
 * use so the metric array is interchangeable between them.
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

      <View style={styles.grid}>
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </View>
    </View>
  );
}

/**
 * One flat metric: a top hairline, an eyebrow label, the value with an
 * optional muted unit, and an optional change line colored by direction
 * (a trend icon for up/down, text only for neutral).
 */
function Stat({ label, value, unit, change }: StatRowMetric) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  const changeColor = !change
    ? undefined
    : change.direction === "up"
      ? theme.colors.success
      : change.direction === "down"
        ? theme.colors.destructive
        : theme.colors.textDim;

  return (
    <View style={styles.stat}>
      <EyebrowText style={styles.label}>{label}</EyebrowText>

      <View style={styles.valueRow}>
        <StyledText size="xxl" fontWeight="bold" style={styles.value}>
          {value}
        </StyledText>
        {!!unit && (
          <StyledText size="base" style={styles.unit}>
            {unit}
          </StyledText>
        )}
      </View>

      {!!change && (
        <View style={styles.change}>
          {change.direction !== "neutral" && (
            <Icon
              name={change.direction === "up" ? "trending-up" : "trending-down"}
              size={spacing.iconXs}
              color={changeColor}
              decorative
            />
          )}
          <StyledText size="sm" style={{ color: changeColor }}>
            {change.value}
          </StyledText>
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
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.xl,
    },
    header: {
      marginBottom: spacing.md,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.md,
      rowGap: spacing.lg,
    },
    // Two-up on phone: just under half a row so the gap fits without
    // overflowing. flexBasis (not width) so stats still grow to fill a wider
    // row — same treatment as client/templates/stats.
    stat: {
      flexGrow: 1,
      flexBasis: "47%",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: spacing.smd,
      gap: spacing.xs,
    },
    label: {
      color: theme.colors.textDim,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
    },
    value: {
      color: theme.colors.foreground,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      color: theme.colors.textDim,
      marginLeft: spacing.xxs,
      marginBottom: spacing.xxs,
    },
    change: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
    },
  });

const themedStyles = createThemedStyles(createStyles);
