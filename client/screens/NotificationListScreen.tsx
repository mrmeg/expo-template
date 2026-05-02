import React, { ReactNode, useCallback, useMemo } from "react";
import {
  View,
  SectionList,
  RefreshControl,
  Pressable,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Skeleton } from "@mrmeg/expo-ui/components/Skeleton";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

interface NotificationSection {
  title: string;
  data: NotificationItem[];
}

export interface NotificationListScreenProps {
  notifications: NotificationItem[];
  onNotificationPress?: (notification: NotificationItem) => void;
  onArchive?: (notification: NotificationItem) => void;
  onDelete?: (notification: NotificationItem) => void;
  onMarkAllRead?: () => void;
  loading?: boolean;
  skeletonCount?: number;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatSectionTitle(date: Date): string {
  const now = new Date();
  if (isSameDay(date, now)) return "TODAY";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return "YESTERDAY";

  return date
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toUpperCase();
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupNotifications(items: NotificationItem[]): NotificationSection[] {
  const sorted = [...items].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const groups = new Map<string, NotificationItem[]>();

  for (const item of sorted) {
    const key = formatSectionTitle(item.timestamp);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return Array.from(groups.entries()).map(([title, data]) => ({
    title,
    data,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationListScreen({
  notifications,
  onNotificationPress,
  onArchive,
  onDelete,
  onMarkAllRead,
  loading = false,
  skeletonCount = 5,
  emptyIcon = "bell-off",
  emptyTitle = "All caught up!",
  emptyDescription,
  onRefresh,
  refreshing = false,
  header,
  style: styleOverride,
}: NotificationListScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const sections = useMemo(
    () => groupNotifications(notifications),
    [notifications]
  );

  const handlePress = useCallback(
    (item: NotificationItem) => {
      onNotificationPress?.(item);
    },
    [onNotificationPress]
  );

  const handleLongPress = useCallback(
    (item: NotificationItem) => {
      onArchive?.(item);
    },
    [onArchive]
  );

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styleOverride]}>
        {header}
        <View style={styles.skeletonList}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <View key={i} style={styles.skeletonItem}>
              <Skeleton width={36} height={36} circle />
              <View style={styles.skeletonText}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="85%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name={emptyIcon} size={48} color={theme.colors.mutedForeground} />
      </View>
      <SansSerifBoldText style={styles.emptyTitle}>
        {emptyTitle}
      </SansSerifBoldText>
      {emptyDescription && (
        <SansSerifText style={styles.emptyDescription}>
          {emptyDescription}
        </SansSerifText>
      )}
    </View>
  );

  // -----------------------------------------------------------------------
  // Renderers
  // -----------------------------------------------------------------------

  const renderSectionHeader = ({
    section,
  }: {
    section: NotificationSection;
  }) => (
    <View style={styles.sectionHeader}>
      <SansSerifText style={styles.sectionTitle}>{section.title}</SansSerifText>
    </View>
  );

  const renderItem = ({
    item,
    index,
  }: {
    item: NotificationItem;
    index: number;
  }) => (
    <AnimatedView
      type="fadeSlideUp"
      delay={Math.min(index, 10) * STAGGER_DELAY}
    >
      <Pressable
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
        style={
          Platform.OS === "web"
            ? {
                ...StyleSheet.flatten([
                  styles.row,
                  !item.read && styles.rowUnread,
                ]),
                cursor: "pointer" as any,
              }
            : StyleSheet.flatten([styles.row, !item.read && styles.rowUnread])
        }
      >
        <View style={styles.iconCircle}>
          <Icon name={item.icon} size={18} color={theme.colors.foreground} />
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTitleLine}>
            <SansSerifText
              style={[styles.rowTitle, !item.read && styles.rowTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </SansSerifText>
            <SansSerifText style={styles.rowTime}>
              {formatRelativeTime(item.timestamp)}
            </SansSerifText>
          </View>
          <SansSerifText style={styles.rowBody} numberOfLines={2}>
            {item.body}
          </SansSerifText>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    </AnimatedView>
  );

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  const listHeader = (
    <>
      {header}
      {onMarkAllRead && notifications.some((n) => !n.read) && (
        <View style={styles.markAllContainer}>
          <Button preset="ghost" size="sm" onPress={onMarkAllRead}>
            Mark all as read
          </Button>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.container, styleOverride]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
      />
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
    listContent: {
      paddingBottom: spacing.xxl,
    },
    emptyList: {
      flexGrow: 1,
    },

    // Mark all read
    markAllContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },

    // Section headers
    sectionHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
      backgroundColor: theme.colors.background,
    },
    sectionTitle: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },

    // Notification row
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    rowUnread: {
      backgroundColor: theme.colors.card,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    rowContent: {
      flex: 1,
      gap: spacing.xxs,
    },
    rowTitleLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    rowTitle: {
      fontSize: 15,
      color: theme.colors.foreground,
      flex: 1,
    },
    rowTitleUnread: {
      fontWeight: "600",
    },
    rowTime: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    rowBody: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      lineHeight: 18,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      fontSize: 18,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },

    // Skeleton
    skeletonList: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    skeletonItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    skeletonText: {
      flex: 1,
      gap: spacing.xs,
    },
  });
