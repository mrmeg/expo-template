import React, { useMemo, ReactNode, useCallback } from "react";
import {
  View,
  FlatList,
  ScrollView,
  Pressable,
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
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { SkeletonCard } from "@mrmeg/expo-ui/components/Skeleton";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardGridCategory {
  key: string;
  label: string;
}

export interface SortOption {
  key: string;
  label: string;
}

export interface CardGridEmptyAction {
  label: string;
  onPress: () => void;
}

export interface CardGridScreenProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  categories?: CardGridCategory[];
  selectedCategory?: string;
  onCategoryChange?: (key: string) => void;
  sortOptions?: SortOption[];
  selectedSort?: string;
  onSortChange?: (key: string) => void;
  columns?: number;
  cardSpacing?: number;
  onCardPress?: (item: T) => void;
  loading?: boolean;
  skeletonCount?: number;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: CardGridEmptyAction;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardGridScreen<T>({
  data,
  renderCard,
  keyExtractor,
  categories,
  selectedCategory,
  onCategoryChange,
  sortOptions,
  selectedSort,
  onSortChange,
  columns = 2,
  cardSpacing = spacing.md,
  onCardPress,
  loading = false,
  skeletonCount = 6,
  emptyIcon = "grid",
  emptyTitle = "No items",
  emptyDescription,
  emptyAction,
  onRefresh,
  refreshing = false,
  header,
  style: styleOverride,
}: CardGridScreenProps<T>) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, cardSpacing), [theme, cardSpacing]);

  // Hoist per-column flex objects so renderItem hands stable style references to
  // each row instead of allocating fresh ones every render.
  const columnFlexStyle = useMemo<ViewStyle>(() => ({ flex: 1 / columns }), [columns]);
  const fullFlexStyle = useMemo<ViewStyle>(() => ({ flex: 1 }), []);

  // -------------------------------------------------------------------------
  // Sort cycling
  // -------------------------------------------------------------------------

  const handleSortCycle = useCallback(() => {
    if (!sortOptions || sortOptions.length === 0 || !onSortChange) return;
    const currentIndex = sortOptions.findIndex((o) => o.key === selectedSort);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    onSortChange(sortOptions[nextIndex].key);
  }, [sortOptions, selectedSort, onSortChange]);

  const selectedSortLabel =
    sortOptions?.find((o) => o.key === selectedSort)?.label ??
    sortOptions?.[0]?.label;

  // -------------------------------------------------------------------------
  // Category tabs
  // -------------------------------------------------------------------------

  const renderCategoryTabs = useCallback(() => {
    if (!categories || categories.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
        style={styles.categoryScroll}
      >
        {categories.map((cat) => {
          const isSelected = cat.key === selectedCategory;
          return (
            <Pressable
              key={cat.key}
              onPress={() => onCategoryChange?.(cat.key)}
              style={[
                styles.categoryPill,
                isSelected && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <SansSerifText
                style={[
                  styles.categoryText,
                  isSelected && {
                    color: theme.colors.primaryForeground,
                  },
                ]}
              >
                {cat.label}
              </SansSerifText>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }, [categories, selectedCategory, onCategoryChange, styles, theme.colors.primary, theme.colors.primaryForeground]);

  // -------------------------------------------------------------------------
  // Sort row
  // -------------------------------------------------------------------------

  const renderSortRow = useCallback(() => {
    if (!sortOptions || sortOptions.length === 0) return null;

    return (
      <View style={styles.sortRow}>
        <Pressable onPress={handleSortCycle} style={styles.sortButton}>
          <SansSerifText style={styles.sortLabel}>{selectedSortLabel}</SansSerifText>
          <Icon name="chevron-down" size={14} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
    );
  }, [sortOptions, handleSortCycle, selectedSortLabel, styles, theme.colors.mutedForeground]);

  // -------------------------------------------------------------------------
  // List plumbing — stable renderItem / header so FlatList can window.
  // Declared before any early return to satisfy the Rules of Hooks.
  // -------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const delay = Math.min(index, 10) * STAGGER_DELAY;

      if (onCardPress) {
        return (
          <Pressable onPress={() => onCardPress(item)} style={columnFlexStyle}>
            <AnimatedView type="fadeSlideUp" delay={delay} style={fullFlexStyle}>
              {renderCard(item, index)}
            </AnimatedView>
          </Pressable>
        );
      }

      return (
        <AnimatedView type="fadeSlideUp" delay={delay} style={columnFlexStyle}>
          {renderCard(item, index)}
        </AnimatedView>
      );
    },
    [onCardPress, renderCard, columnFlexStyle, fullFlexStyle]
  );

  const columnWrapperStyle = useMemo<ViewStyle | undefined>(
    () => (columns > 1 ? { gap: cardSpacing } : undefined),
    [columns, cardSpacing]
  );

  // Pass a component (not an element) so FlatList builds the header JSX lazily —
  // never during an early-return render. renderCategoryTabs / renderSortRow are
  // memoized, so this callback identity is stable across unrelated renders.
  const ListHeader = useCallback(
    () => (
      <>
        {header}
        {renderCategoryTabs()}
        {renderSortRow()}
      </>
    ),
    [header, renderCategoryTabs, renderSortRow]
  );

  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      ) : undefined,
    [onRefresh, refreshing, theme.colors.primary]
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styleOverride]}>
        {header}
        {renderCategoryTabs()}
        {renderSortRow()}
        <View style={styles.skeletonGrid}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <View key={i} style={{ flex: 1 / columns }}>
              <SkeletonCard showAvatar={false} imageHeight={120} textLines={2} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

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
        <Button preset="default" onPress={emptyAction.onPress} text={emptyAction.label} style={styles.emptyButton} />
      )}
    </View>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={[styles.container, styleOverride]}>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        numColumns={columns}
        columnWrapperStyle={columnWrapperStyle}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={data.length === 0 ? styles.emptyFlatList : styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme, cardSpacing: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // Category tabs
    categoryScroll: {
      flexGrow: 0,
    },
    categoryContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    categoryPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusMd,
      backgroundColor: "transparent",
    },
    categoryText: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },

    // Sort row
    sortRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    sortButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    sortLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },

    // Grid
    gridContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: cardSpacing,
    },

    // Skeleton loading
    skeletonGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing.lg,
      gap: cardSpacing,
    },

    // Empty state
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
  });
