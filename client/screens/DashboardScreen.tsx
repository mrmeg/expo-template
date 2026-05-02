import React, { ReactNode } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
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

const TREND_ICON: Record<MetricCard["trend"], IconName> = {
  up: "trending-up",
  down: "trending-down",
  flat: "minus",
};

function getTrendColor(trend: MetricCard["trend"], theme: Theme): string {
  if (trend === "up") return theme.colors.accent;
  if (trend === "down") return theme.colors.destructive;
  return theme.colors.mutedForeground;
}

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
  width: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
  theme: Theme;
}) {
  return (
    <View
      style={[
        {
          width: width as any,
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
    <View style={styles.metricCard}>
      <SkeletonBox width={20} height={20} radius={spacing.radiusSm} theme={theme} />
      <SkeletonBox width={80} height={13} theme={theme} style={{ marginTop: spacing.sm }} />
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
      <View style={[styles.chartPlaceholder, { height: 120 }]}>
        <SkeletonBox width={60} height={14} theme={theme} />
      </View>
    </View>
  );
}

function SkeletonActivityRow({ theme, styles }: { theme: Theme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: theme.colors.muted }]} />
      <View style={styles.activityContent}>
        <SkeletonBox width={140} height={14} theme={theme} />
        <SkeletonBox width={200} height={12} theme={theme} style={{ marginTop: spacing.xs }} />
      </View>
      <SkeletonBox width={40} height={12} theme={theme} />
    </View>
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
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  // Track stagger index across all animated groups
  let staggerIndex = 0;

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {/* Header */}
        {header}

        {/* Title */}
        {title && (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * staggerIndex++}>
            <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
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
            {metrics.map((metric, index) => {
              const delay = STAGGER_DELAY * staggerIndex++;
              return (
                <AnimatedView key={metric.label} type="fadeSlideUp" delay={delay}>
                  <View style={[styles.metricCard, getShadowStyle("subtle")]}>
                    {metric.icon && (
                      <Icon name={metric.icon} size={20} color={theme.colors.mutedForeground} />
                    )}
                    <SansSerifText style={styles.metricLabel}>{metric.label}</SansSerifText>
                    <SansSerifBoldText style={styles.metricValue}>{metric.value}</SansSerifBoldText>
                    <View style={styles.trendRow}>
                      <Icon
                        name={TREND_ICON[metric.trend]}
                        size={14}
                        color={getTrendColor(metric.trend, theme)}
                      />
                      {metric.trendValue && (
                        <SansSerifText
                          style={[styles.trendText, { color: getTrendColor(metric.trend, theme) }]}
                        >
                          {metric.trendValue}
                        </SansSerifText>
                      )}
                    </View>
                  </View>
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
                    <SansSerifText style={styles.toggleLabel}>
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
                      <SansSerifBoldText style={styles.sectionTitle}>
                        {chart.title}
                      </SansSerifBoldText>
                    </View>
                  )}
                  <View style={[styles.chartPlaceholder, { height: chart.height ?? 180 }]}>
                    <SansSerifText style={styles.chartPlaceholderText}>Chart</SansSerifText>
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
            {sections.map((section, index) => {
              const delay = STAGGER_DELAY * staggerIndex++;
              return (
                <AnimatedView key={section.title} type="fadeSlideUp" delay={delay}>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <SansSerifBoldText style={styles.sectionTitle}>
                        {section.title}
                      </SansSerifBoldText>
                      {section.viewAllLabel && section.onViewAll && (
                        <Pressable
                          onPress={section.onViewAll}
                          style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
                        >
                          <SansSerifText style={styles.viewAllText}>
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

        {/* Activity feed */}
        {loading ? (
          <View style={styles.activityContainer}>
            <SansSerifBoldText style={styles.sectionTitle}>{activityTitle}</SansSerifBoldText>
            <View style={[styles.activityCard, getShadowStyle("subtle")]}>
              {[0, 1, 2].map((i) => (
                <View key={i}>
                  <SkeletonActivityRow theme={theme} styles={styles} />
                  {i < 2 && <View style={styles.activityDivider} />}
                </View>
              ))}
            </View>
          </View>
        ) : activityFeed && activityFeed.length > 0 ? (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * staggerIndex++}>
            <View style={styles.activityContainer}>
              <SansSerifBoldText style={styles.sectionTitle}>{activityTitle}</SansSerifBoldText>
              <View style={[styles.activityCard, getShadowStyle("subtle")]}>
                {activityFeed.map((item, index) => (
                  <View key={item.id}>
                    <Pressable
                      onPress={onActivityPress ? () => onActivityPress(item) : undefined}
                      style={
                        Platform.OS === "web" && onActivityPress
                          ? { ...styles.activityRow, cursor: "pointer" as any }
                          : styles.activityRow
                      }
                    >
                      <View style={styles.activityIcon}>
                        <Icon name={item.icon} size={16} color={theme.colors.foreground} />
                      </View>
                      <View style={styles.activityContent}>
                        <SansSerifText style={styles.activityTitle}>{item.title}</SansSerifText>
                        {item.description && (
                          <SansSerifText style={styles.activityDescription}>
                            {item.description}
                          </SansSerifText>
                        )}
                      </View>
                      <SansSerifText style={styles.activityTimestamp}>{item.timestamp}</SansSerifText>
                    </Pressable>
                    {index < activityFeed.length - 1 && <View style={styles.activityDivider} />}
                  </View>
                ))}
              </View>
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
      paddingBottom: spacing.xxl,
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      color: theme.colors.foreground,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },

    // Metric cards
    metricsRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    metricCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.md,
      minWidth: 140,
    },
    metricLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      marginTop: spacing.sm,
    },
    metricValue: {
      fontSize: 24,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      marginTop: spacing.xxs,
    },
    trendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      marginTop: spacing.xs,
    },
    trendText: {
      fontSize: 12,
      fontWeight: "500",
    },

    // Date range toggle
    dateRangeContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: "500",
    },

    // Chart sections
    chartSectionsContainer: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    chartPlaceholder: {
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
    chartPlaceholderText: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },

    // Sections
    sectionsContainer: {
      paddingHorizontal: spacing.lg,
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
      fontSize: 18,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    viewAllText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "500",
    },

    // Activity feed
    activityContainer: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    activityCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    activityIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    activityContent: {
      flex: 1,
      marginRight: spacing.sm,
    },
    activityTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    activityDescription: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xxs,
    },
    activityTimestamp: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    activityDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md + 32 + spacing.md,
    },
  });
