import React, { useMemo, ReactNode, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { LegendList, type ColumnWrapperStyle } from "@legendapp/list/react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { SkeletonCard } from "@mrmeg/expo-ui/components/Skeleton";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
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
// Constants
// ---------------------------------------------------------------------------

/** Card image (120) + title/description lines + padding of a typical card. */
const ESTIMATED_CARD_SIZE = 200;

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
  const styles = themedStyles(theme);

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
                size="body"
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
          <SansSerifText size="sm" style={styles.sortLabel}>{selectedSortLabel}</SansSerifText>
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

  // LegendList applies these gaps as padding on each item container, so this
  // covers both the row gutter (columnGap) and the space between rows (rowGap)
  // that `contentContainerStyle`'s gap used to provide under FlatList.
  const columnWrapperStyle = useMemo<ColumnWrapperStyle>(
    () => (columns > 1 ? { gap: cardSpacing } : { rowGap: cardSpacing }),
    [columns, cardSpacing]
  );

  // With multiple columns LegendList over-extends the item layer by the column
  // gap (negative margin) and re-adds half of it as per-item padding, so cards
  // would bleed `cardSpacing / 2` past the content padding on each edge. Pad
  // the content box by that much — and pull the header back out — so cards keep
  // the same width and edge alignment they had under FlatList.
  const gridEdgeBleed = columns > 1 ? cardSpacing / 2 : 0;
  const gridPaddingStyle = useMemo<ViewStyle>(
    () => ({ paddingHorizontal: spacing.lg + gridEdgeBleed }),
    [gridEdgeBleed]
  );
  const headerOutsetStyle = useMemo<ViewStyle | undefined>(
    () => (gridEdgeBleed > 0 ? { marginHorizontal: -gridEdgeBleed } : undefined),
    [gridEdgeBleed]
  );

  const cardGapStyle = useMemo<ViewStyle>(() => ({ gap: cardSpacing }), [cardSpacing]);

  // Pass a component (not an element) so the list builds the header JSX lazily —
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
        <View style={[styles.skeletonGrid, cardGapStyle]}>
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
      <SansSerifBoldText size="lg" style={styles.emptyTitle}>{emptyTitle}</SansSerifBoldText>
      {emptyDescription && (
        <SansSerifText size="base" style={styles.emptyDescription}>{emptyDescription}</SansSerifText>
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
      <LegendList
        data={data}
        keyExtractor={keyExtractor}
        numColumns={columns}
        columnWrapperStyle={columnWrapperStyle}
        renderItem={renderItem}
        estimatedItemSize={ESTIMATED_CARD_SIZE}
        recycleItems={false}
        ListHeaderComponent={ListHeader}
        ListHeaderComponentStyle={data.length === 0 ? undefined : headerOutsetStyle}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          data.length === 0 ? styles.emptyList : [styles.gridContent, gridPaddingStyle]
        }
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
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
      color: theme.colors.mutedForeground,
    },

    // Grid — horizontal padding is applied at the call site (gridPaddingStyle)
    // because it depends on the column gap.
    gridContent: {
      paddingBottom: spacing.xxl,
    },

    // Skeleton loading
    skeletonGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing.lg,
    },

    // Empty state
    emptyList: {
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
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    emptyDescription: {
      color: theme.colors.mutedForeground,
      textAlign: "center",
    },
    emptyButton: {
      marginTop: spacing.lg,
    },
  });

const themedStyles = createThemedStyles(createStyles);
