import React from "react";
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { EyebrowText, SansSerifText, StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import type { StatCardChange } from "@mrmeg/expo-ui/components/StatCard";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatsMetric {
  label: string;
  value: string | number;
  unit?: string;
  change?: StatCardChange;
}

export interface StatsScreenProps {
  eyebrow?: string;
  title: string;
  description?: string;
  stats: StatsMetric[];
  /** Optional note rendered below the grid (e.g. data freshness, a source link). */
  footerNote?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------

// Only "up"/"down" get a directional trend icon; "neutral" is text-only.
const DIRECTION_ICON: Record<"up" | "down", IconName> = {
  up: "trending-up",
  down: "trending-down",
};

// One flat grid cell: a hairline on top instead of a card around it, so the
// numbers sit on the screen gutter.
function Stat({ label, value, unit, change }: StatsMetric) {
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
      <EyebrowText style={styles.statLabel}>{label}</EyebrowText>

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
        <View style={styles.changeRow}>
          {change.direction !== "neutral" && (
            <Icon
              name={DIRECTION_ICON[change.direction]}
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
// Component
// ---------------------------------------------------------------------------

/**
 * StatsScreen
 *
 * Metrics block: `SectionHeader` followed by a flat stat grid (2 columns on
 * phone via flexWrap; each stat topped by a hairline, not boxed in a card),
 * with an optional footer note.
 *
 * @example
 * ```tsx
 * <StatsScreen
 *   eyebrow="By the numbers"
 *   title="Trusted at scale"
 *   stats={[
 *     { label: "Active users", value: "48.2", unit: "k", change: { value: "+12.5%", direction: "up" } },
 *     { label: "Uptime", value: "99.98", unit: "%" },
 *   ]}
 * />
 * ```
 */
export function StatsScreen({
  eyebrow,
  title,
  description,
  stats,
  footerNote,
  style: styleOverride,
}: StatsScreenProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader eyebrow={eyebrow} title={title} description={description} style={styles.header} />

        <View style={styles.grid}>
          {stats.map((stat) => (
            <Stat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              unit={stat.unit}
              change={stat.change}
            />
          ))}
        </View>

        {!!footerNote && <SansSerifText size="sm" style={styles.footerNote}>{footerNote}</SansSerifText>}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    // The screen's one horizontal inset: nothing inside pads horizontally.
    scrollContent: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      marginBottom: spacing.lg,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.md,
      rowGap: spacing.lg,
    },
    // Two columns on phone: each stat takes just under half the row width so
    // the gap fits without overflowing (flexBasis, not width, so it still
    // grows to fill leftover space on wider viewports).
    stat: {
      flexGrow: 1,
      flexBasis: "47%",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: spacing.smd,
      gap: spacing.xs,
    },
    statLabel: {
      color: theme.colors.textDim,
    },
    // flex-end, with the unit nudged up, sits the smaller unit on the value's
    // baseline.
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
    changeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
    },
    footerNote: {
      color: theme.colors.mutedForeground,
      marginTop: spacing.lg,
    },
  });

const themedStyles = createThemedStyles(createStyles);
