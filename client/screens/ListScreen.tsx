import React, { useMemo, ReactNode, useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Skeleton } from "@mrmeg/expo-ui/components/Skeleton";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListScreenEmptyAction {
  label: string;
  onPress: () => void;
}

export interface ListScreenProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ListScreenEmptyAction;
  loading?: boolean;
  skeletonCount?: number;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
  onRefresh,
  refreshing = false,
  emptyIcon = "inbox",
  emptyTitle = "No items",
  emptyDescription,
  emptyAction,
  loading = false,
  skeletonCount = 5,
  header,
  style: styleOverride,
}: ListScreenProps<T>) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch]
  );

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styleOverride]}>
        {header}
        {searchable && (
          <View style={styles.searchContainer}>
            <TextInput
              placeholder={searchPlaceholder}
              value=""
              editable={false}
              leftElement={<Icon name="search" size={18} color={theme.colors.mutedForeground} />}
            />
          </View>
        )}
        <View style={styles.skeletonList}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <View key={i} style={styles.skeletonItem}>
              <Skeleton width={40} height={40} borderRadius={spacing.radiusMd} />
              <View style={styles.skeletonText}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name={emptyIcon} size={48} color={theme.colors.mutedForeground} />
      </View>
      <SansSerifBoldText style={styles.emptyTitle}>{emptyTitle}</SansSerifBoldText>
      {emptyDescription && (
        <SansSerifText style={styles.emptyDescription}>{emptyDescription}</SansSerifText>
      )}
      {emptyAction && (
        <Button preset="default" onPress={emptyAction.onPress} style={styles.emptyButton}>
          {emptyAction.label}
        </Button>
      )}
    </View>
  );

  return (
    <View style={[styles.container, styleOverride]}>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => (
          <AnimatedView
            type="fadeSlideUp"
            delay={Math.min(index, 10) * STAGGER_DELAY}
          >
            {renderItem(item, index)}
          </AnimatedView>
        )}
        ListHeaderComponent={
          <>
            {header}
            {searchable && (
              <View style={styles.searchContainer}>
                <TextInput
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  leftElement={<Icon name="search" size={18} color={theme.colors.mutedForeground} />}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={data.length === 0 ? styles.emptyFlatList : styles.listContent}
        showsVerticalScrollIndicator={false}
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
    searchContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    listContent: {
      paddingBottom: spacing.xxl,
    },
    emptyFlatList: {
      flexGrow: 1,
    },
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
    emptyButton: {
      marginTop: spacing.lg,
    },
    skeletonList: {
      paddingHorizontal: spacing.lg,
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
