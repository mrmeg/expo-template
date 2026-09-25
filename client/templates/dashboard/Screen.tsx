import React, { useMemo, ReactNode } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  StyleProp,
  ViewStyle,
  DimensionValue,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { IconName } from "@mrmeg/expo-ui/components/Icon";
import { StatCard, type StatChangeDirection } from "@mrmeg/expo-ui/components/StatCard";
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@mrmeg/expo-ui/components/Item";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricCard {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  trendValue?: string;
  icon?: IconName;
}

export interface DashboardSection {
  title: string;
  viewAllLabel?: string;
  onViewAll?: () => void;
  content: ReactNode;
}

export interface ActivityItem {
  id: string;
  icon: IconName;
  title: string;
  description?: string;
  timestamp: string;
}

export interface DashboardDateRange {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

export interface ChartSection {
  title?: string;
  height?: number;
}

export interface DashboardScreenProps {
  title?: string;
  metrics?: MetricCard[];
  sections?: DashboardSection[];
  activityFeed?: ActivityItem[];
  activityTitle?: string;
  onActivityPress?: (item: ActivityItem) => void;
  dateRange?: DashboardDateRange;
  chartSections?: ChartSection[];
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// StatCard's "up"/"down" map straight across; "flat" (this template's
// no-change state) maps to StatCard's "neutral" (text-only, no trend icon).
const TREND_DIRECTION: Record<MetricCard["trend"], StatChangeDirection> = {
  up: "up",
  down: "down",
  flat: "neutral",
};

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonBox({
  width,
  height,
  radius,
  style,
  theme,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: ViewStyle;
  theme: Theme;
}) {
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? spacing.radiusSm,
          backgroundColor: theme.colors.muted,
        },
        style,
      ]}
    />
  );
}

function SkeletonMetricCard({ theme, styles }: { theme: Theme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.metricCard, styles.skeletonMetricCard]}>
      <SkeletonBox width={80} height={13} theme={theme} />
      <SkeletonBox width={60} height={24} theme={theme} style={{ marginTop: spacing.xs }} />
      <SkeletonBox width={50} height={12} theme={theme} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

function SkeletonSection({ theme, styles }: { theme: Theme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <SkeletonBox width={120} height={18} theme={theme} />
        <SkeletonBox width={50} height={14} theme={theme} />
      </View>
      <SkeletonBox width="100%" height={120} radius={spacing.radiusMd} theme={theme} />
    </View>
  );
}

// A flat row shaped like an activity Item: the empty media slot is the icon
// placeholder, and the ItemGroup around it draws the separators.
function SkeletonActivityRow({ theme }: { theme: Theme }) {
  return (
    <Item>
      <ItemMedia size={32} />
      <ItemContent>
        <SkeletonBox width={140} height={14} theme={theme} />
        <SkeletonBox width={200} height={12} theme={theme} />
      </ItemContent>
      <ItemActions>
        <SkeletonBox width={40} height={12} theme={theme} />
      </ItemActions>
    </Item>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardScreen({
  title,
  metrics,
  sections,
  activityFeed,
  activityTitle = "Recent Activity",
  onActivityPress,
  dateRange,
  chartSections,
  loading = false,
  onRefresh,
  refreshing = false,
  header,
  style: styleOverride,
}: DashboardScreenProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  // Memoize the refresh control so the ScrollView doesn't get a fresh element
  // every render.
  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      ) : undefined,
    [onRefresh, refreshing]
  );

  // Track stagger index across all animated groups
  let staggerIndex = 0;

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* Header */}
        {header}

        {/* Title */}
        {title && (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * staggerIndex++}>
            <SansSerifBoldText size="xxl" style={styles.title}>{title}</SansSerifBoldText>
          </AnimatedView>
        )}

        {/* Metric cards — horizontal scroll */}
        {loading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
            {[0, 1, 2].map((i) => (
              <SkeletonMetricCard key={i} theme={theme} styles={styles} />
            ))}
          </ScrollView>
        ) : metrics && metrics.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
            {metrics.map((metric) => {
              const delay = STAGGER_DELAY * staggerIndex++;
              return (
                <AnimatedView key={metric.label} type="fadeSlideUp" delay={delay}>
                  <StatCard
                    label={metric.label}
                    value={metric.value}
                    icon={metric.icon}
                    change={
                      metric.trendValue
                        ? { value: metric.trendValue, direction: TREND_DIRECTION[metric.trend] }
                        : undefined
                    }
                    style={styles.metricCard}
                  />
                </AnimatedView>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Date range toggle */}
        {dateRange && (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * staggerIndex++}>
            <View style={styles.dateRangeContainer}>
              <ToggleGroup
                type="single"
                value={dateRange.selected}
                onValueChange={(value) => {
                  if (value) dateRange.onSelect(value);
                }}
                variant="outline"
              >
                {dateRange.options.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    <SansSerifText size="sm" fontWeight="medium">
                      {option.label}
                    </SansSerifText>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </View>
          </AnimatedView>
        )}

        {/* Chart sections */}
        {chartSections && chartSections.length > 0 && (
          <View style={styles.chartSectionsContainer}>
            {chartSections.map((chart, index) => (
              <AnimatedView
                key={chart.title ?? `chart-${index}`}
                type="fadeSlideUp"
                delay={STAGGER_DELAY * staggerIndex++}
              >
                <View style={styles.section}>
                  {chart.title && (
                    <View style={styles.sectionHeader}>
                      <SansSerifBoldText size="lg" style={styles.sectionTitle}>
                        {chart.title}
                      </SansSerifBoldText>
                    </View>
                  )}
                  <View style={[styles.chartPlaceholder, { height: chart.height ?? 180 }]}>
                    <SansSerifText size="base" style={styles.chartPlaceholderText}>Chart</SansSerifText>
                  </View>
                </View>
              </AnimatedView>
            ))}
          </View>
        )}

        {/* Sections */}
        {loading ? (
          <View style={styles.sectionsContainer}>
            {[0, 1].map((i) => (
              <SkeletonSection key={i} theme={theme} styles={styles} />
            ))}
          </View>
        ) : sections && sections.length > 0 ? (
          <View style={styles.sectionsContainer}>
            {sections.map((section) => {
              const delay = STAGGER_DELAY * staggerIndex++;
              return (
                <AnimatedView key={section.title} type="fadeSlideUp" delay={delay}>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <SansSerifBoldText size="lg" style={styles.sectionTitle}>
                        {section.title}
                      </SansSerifBoldText>
                      {section.viewAllLabel && section.onViewAll && (
                        <Pressable
                          onPress={section.onViewAll}
                          style={Platform.OS === "web" ? { cursor: "pointer" as const } : undefined}
                        >
                          <SansSerifText size="base" fontWeight="medium" style={styles.viewAllText}>
                            {section.viewAllLabel}
                          </SansSerifText>
                        </Pressable>
                      )}
                    </View>
                    {section.content}
                  </View>
                </AnimatedView>
              );
            })}
          </View>
        ) : null}

        {/* Activity feed: full-width rows that carry their own 16pt inset, so
            only the title pads horizontally. */}
        {loading ? (
          <View style={styles.activityContainer}>
            <View style={styles.activityHeader}>
              <SansSerifBoldText size="lg" style={styles.sectionTitle}>{activityTitle}</SansSerifBoldText>
            </View>
            <ItemGroup>
              {[0, 1, 2].map((i) => (
                <SkeletonActivityRow key={i} theme={theme} />
              ))}
            </ItemGroup>
          </View>
        ) : activityFeed && activityFeed.length > 0 ? (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * staggerIndex++}>
            <View style={styles.activityContainer}>
              <View style={styles.activityHeader}>
                <SansSerifBoldText size="lg" style={styles.sectionTitle}>{activityTitle}</SansSerifBoldText>
              </View>
              <ItemGroup>
                {activityFeed.map((item) => (
                  <Item
                    key={item.id}
                    onPress={onActivityPress ? () => onActivityPress(item) : undefined}
                  >
                    <ItemMedia size={32} icon={item.icon} iconSize={16} iconColor="foreground" />
                    <ItemContent>
                      <ItemTitle>{item.title}</ItemTitle>
                      {item.description && <ItemDescription>{item.description}</ItemDescription>}
                    </ItemContent>
                    <ItemActions>
                      <ItemDescription>{item.timestamp}</ItemDescription>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </View>
          </AnimatedView>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 960;

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
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingBottom: spacing.xxl,
    },
    // Margin, not padding: StyledText owns its box spacing, and margins
    // reproduce the previous inset exactly (nothing paints behind the title).
    title: {
      color: theme.colors.foreground,
      marginHorizontal: spacing.screenPadding,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },

    // Metric cards
    metricsRow: {
      paddingHorizontal: spacing.screenPadding,
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    metricCard: {
      minWidth: 140,
    },
    // StatCard is a Card (bg/border/radius/shadow built in) — the skeleton
    // needs its own surface + padding since it renders a raw View instead.
    skeletonMetricCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.cardPadding,
    },

    // Date range toggle
    dateRangeContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },

    // Chart sections
    chartSectionsContainer: {
      paddingHorizontal: spacing.screenPadding,
      gap: spacing.md,
    },
    // Stands in for the chart itself, so it spans the column on a plain fill
    // rather than framing it in a bordered panel.
    chartPlaceholder: {
      borderRadius: spacing.radiusMd,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.muted,
    },
    chartPlaceholderText: {
      color: theme.colors.mutedForeground,
    },

    // Sections
    sectionsContainer: {
      paddingHorizontal: spacing.screenPadding,
      gap: spacing.lg,
      marginTop: spacing.md,
    },
    section: {
      gap: spacing.sm,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      color: theme.colors.foreground,
    },
    viewAllText: {
      color: theme.colors.accent,
    },

    // Activity feed. No horizontal padding on the container: the rows carry
    // the inset, and only the title wrapper pads to the gutter.
    activityContainer: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    activityHeader: {
      paddingHorizontal: spacing.screenPadding,
    },
  });

const themedStyles = createThemedStyles(createStyles);
