import React, { ReactNode, useCallback } from "react";
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
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { useTheme } from "@/client/hooks/useTheme";
import { STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import { SkeletonCard } from "@/client/components/ui/Skeleton";
import type { Theme } from "@/client/constants/colors";

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
  const styles = createStyles(theme, cardSpacing);

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

  const renderCategoryTabs = () => {
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
  };

  // -------------------------------------------------------------------------
  // Sort row
  // -------------------------------------------------------------------------

  const renderSortRow = () => {
    if (!sortOptions || sortOptions.length === 0) return null;

    return (
      <View style={styles.sortRow}>
        <Pressable onPress={handleSortCycle} style={styles.sortButton}>
          <SansSerifText style={styles.sortLabel}>{selectedSortLabel}</SansSerifText>
          <Icon name="chevron-down" size={14} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
    );
  };

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
        <Button preset="default" onPress={emptyAction.onPress} style={styles.emptyButton}>
          {emptyAction.label}
        </Button>
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
        columnWrapperStyle={columns > 1 ? { gap: cardSpacing } : undefined}
        renderItem={({ item, index }) => {
          const card = (
            <AnimatedView
              type="fadeSlideUp"
              delay={Math.min(index, 10) * STAGGER_DELAY}
              style={{ flex: 1 / columns }}
            >
              {renderCard(item, index)}
            </AnimatedView>
          );

          if (onCardPress) {
            return (
              <Pressable
                onPress={() => onCardPress(item)}
                style={{ flex: 1 / columns }}
              >
                <AnimatedView
                  type="fadeSlideUp"
                  delay={Math.min(index, 10) * STAGGER_DELAY}
                  style={{ flex: 1 }}
                >
                  {renderCard(item, index)}
                </AnimatedView>
              </Pressable>
            );
          }

          return card;
        }}
        ListHeaderComponent={
          <>
            {header}
            {renderCategoryTabs()}
            {renderSortRow()}
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={data.length === 0 ? styles.emptyFlatList : styles.gridContent}
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
