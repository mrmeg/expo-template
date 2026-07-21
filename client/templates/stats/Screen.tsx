import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { StatCard, type StatCardChange } from "@mrmeg/expo-ui/components/StatCard";
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
// Component
// ---------------------------------------------------------------------------

/**
 * StatsScreen
 *
 * Metrics block: `SectionHeader` followed by a responsive `StatCard` grid
 * (2 columns on phone via flexWrap), with an optional footer note.
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
  const styles = useMemo(() => createStyles(theme), [theme]);

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

        {!!footerNote && <SansSerifText size="sm" style={styles.footerNote}>{footerNote}</SansSerifText>}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const GRID_GAP = spacing.sm;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      marginBottom: spacing.lg,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
    },
    // Two columns on phone: each card takes just under half the row width so
    // the gap fits without overflowing (flexBasis, not width, so it still
    // grows to fill leftover space on wider viewports).
    card: {
      flexGrow: 1,
      flexBasis: "47%",
    },
    footerNote: {
      color: theme.colors.mutedForeground,
      marginTop: spacing.lg,
    },
  });
