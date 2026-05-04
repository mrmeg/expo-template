import React, { useMemo, ReactNode, useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
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

export interface SearchFilter {
  key: string;
  label: string;
  active: boolean;
}

export interface SearchSortOption {
  key: string;
  label: string;
}

export interface SearchResultsEmptyAction {
  label: string;
  onPress: () => void;
}

export interface SearchResultsScreenProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  renderGridItem?: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  initialQuery?: string;
  filters?: SearchFilter[];
  onFilterPress?: (filter: SearchFilter) => void;
  sortOptions?: SearchSortOption[];
  selectedSort?: string;
  onSortChange?: (sortKey: string) => void;
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  gridColumns?: number;
  resultCount?: number;
  resultLabel?: string;
  loading?: boolean;
  skeletonCount?: number;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: SearchResultsEmptyAction;
  emptySuggestions?: string[];
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResultsScreen<T>({
  data,
  renderItem,
  renderGridItem,
  keyExtractor,
  searchPlaceholder = "Search...",
  onSearch,
  initialQuery = "",
  filters,
  onFilterPress,
  sortOptions,
  selectedSort,
  onSortChange,
  viewMode = "list",
  onViewModeChange,
  gridColumns = 2,
  resultCount,
  resultLabel = "results",
  loading = false,
  skeletonCount = 6,
  emptyIcon = "search",
  emptyTitle = "No results found",
  emptyDescription,
  emptyAction,
  emptySuggestions,
  onRefresh,
  refreshing = false,
  header,
  style: styleOverride,
}: SearchResultsScreenProps<T>) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch]
  );

  const handleSortCycle = useCallback(() => {
    if (!sortOptions || sortOptions.length === 0 || !onSortChange) return;
    const currentIndex = sortOptions.findIndex((o) => o.key === selectedSort);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    onSortChange(sortOptions[nextIndex].key);
  }, [sortOptions, selectedSort, onSortChange]);

  const currentSortLabel =
    sortOptions?.find((o) => o.key === selectedSort)?.label ?? sortOptions?.[0]?.label;

  const displayCount = resultCount ?? data.length;
  const isGrid = viewMode === "grid";

  // ---------------------------------------------------------------------------
  // Search bar (shared between loading and loaded states)
  // ---------------------------------------------------------------------------

  const renderSearchBar = (editable = true) => (
    <View style={styles.searchContainer}>
      <TextInput
        placeholder={searchPlaceholder}
        value={editable ? searchQuery : ""}
        onChangeText={editable ? handleSearch : undefined}
        editable={editable}
        leftElement={<Icon name="search" size={18} color={theme.colors.mutedForeground} />}
      />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Filter chips
  // ---------------------------------------------------------------------------

  const renderFilters = () => {
    if (!filters || filters.length === 0) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.filtersContainer}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => onFilterPress?.(filter)}
            style={[
              styles.filterChip,
              filter.active ? styles.filterChipActive : styles.filterChipInactive,
            ]}
          >
            <SansSerifText
              style={[
                styles.filterChipText,
                filter.active
                  ? styles.filterChipTextActive
                  : styles.filterChipTextInactive,
              ]}
            >
              {filter.label}
            </SansSerifText>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  // ---------------------------------------------------------------------------
  // Toolbar (result count, sort, view toggle)
  // ---------------------------------------------------------------------------

  const renderToolbar = () => {
    const hasSortOrToggle = (sortOptions && sortOptions.length > 0) || onViewModeChange;
    if (!hasSortOrToggle && displayCount === 0) return null;

    return (
      <View style={styles.toolbar}>
        <SansSerifText style={styles.resultCountText}>
          {displayCount} {resultLabel}
        </SansSerifText>

        <View style={styles.toolbarRight}>
          {sortOptions && sortOptions.length > 0 && (
            <Pressable onPress={handleSortCycle} style={styles.sortButton}>
              <Icon name="sliders" size={14} color={theme.colors.mutedForeground} />
              {currentSortLabel && (
                <SansSerifText style={styles.sortLabel}>{currentSortLabel}</SansSerifText>
              )}
            </Pressable>
          )}

          {onViewModeChange && (
            <View style={styles.viewToggle}>
              <Pressable
                onPress={() => onViewModeChange("list")}
                style={[
                  styles.viewToggleButton,
                  viewMode === "list" && styles.viewToggleButtonActive,
                ]}
              >
                <Icon
                  name="list"
                  size={16}
                  color={
                    viewMode === "list"
                      ? theme.colors.foreground
                      : theme.colors.mutedForeground
                  }
                />
              </Pressable>
              <Pressable
                onPress={() => onViewModeChange("grid")}
                style={[
                  styles.viewToggleButton,
                  viewMode === "grid" && styles.viewToggleButtonActive,
                ]}
              >
                <Icon
                  name="grid"
                  size={16}
                  color={
                    viewMode === "grid"
                      ? theme.colors.foreground
                      : theme.colors.mutedForeground
                  }
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styleOverride]}>
        {header}
        {renderSearchBar(false)}
        {renderFilters()}
        {renderToolbar()}
        <View style={styles.skeletonList}>
          {isGrid ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <View key={i} style={[styles.skeletonGridItem, { width: `${100 / gridColumns - 2}%` as `${number}%` }]}>
                  <Skeleton width="100%" height={120} borderRadius={spacing.radiusLg} />
                  <View style={styles.skeletonText}>
                    <Skeleton width="80%" height={14} />
                    <Skeleton width="50%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <View key={i} style={styles.skeletonItem}>
                <Skeleton width={40} height={40} borderRadius={spacing.radiusMd} />
                <View style={styles.skeletonText}>
                  <Skeleton width="70%" height={16} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

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
      {emptySuggestions && emptySuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <SansSerifText style={styles.suggestionsLabel}>Try searching for:</SansSerifText>
          <View style={styles.suggestionsRow}>
            {emptySuggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => handleSearch(suggestion)}
                style={styles.suggestionChip}
              >
                <SansSerifText style={styles.suggestionText}>{suggestion}</SansSerifText>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderItemForMode = isGrid && renderGridItem ? renderGridItem : renderItem;

  return (
    <View style={[styles.container, styleOverride]}>
      <FlatList
        key={viewMode}
        data={data}
        keyExtractor={keyExtractor}
        numColumns={isGrid ? gridColumns : 1}
        renderItem={({ item, index }) => (
          <AnimatedView
            type="fadeSlideUp"
            delay={Math.min(index, 10) * STAGGER_DELAY}
            style={isGrid ? styles.gridItemWrapper : undefined}
          >
            {renderItemForMode(item, index)}
          </AnimatedView>
        )}
        ListHeaderComponent={
          <>
            {header}
            {renderSearchBar()}
            {renderFilters()}
            {renderToolbar()}
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={data.length === 0 ? styles.emptyFlatList : styles.listContent}
        columnWrapperStyle={isGrid && data.length > 0 ? styles.gridRow : undefined}
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

    // Search
    searchContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },

    // Filters
    filtersContainer: {
      maxHeight: 44,
    },
    filtersContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusFull,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
    },
    filterChipInactive: {
      backgroundColor: theme.colors.muted,
    },
    filterChipText: {
      fontSize: 13,
    },
    filterChipTextActive: {
      color: theme.colors.primaryForeground,
    },
    filterChipTextInactive: {
      color: theme.colors.mutedForeground,
    },

    // Toolbar
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    resultCountText: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    toolbarRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    sortButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusMd,
      backgroundColor: theme.colors.muted,
    },
    sortLabel: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    viewToggle: {
      flexDirection: "row",
      borderRadius: spacing.radiusMd,
      backgroundColor: theme.colors.muted,
      overflow: "hidden",
    },
    viewToggleButton: {
      padding: spacing.xs,
      borderRadius: spacing.radiusMd,
    },
    viewToggleButtonActive: {
      backgroundColor: theme.colors.background,
    },

    // List
    listContent: {
      paddingBottom: spacing.xxl,
    },
    emptyFlatList: {
      flexGrow: 1,
    },

    // Grid
    gridRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    gridItemWrapper: {
      flex: 1,
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
    emptyButton: {
      marginTop: spacing.lg,
    },
    suggestionsContainer: {
      marginTop: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
    },
    suggestionsLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    suggestionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.xs,
    },
    suggestionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
    },
    suggestionText: {
      fontSize: 13,
      color: theme.colors.foreground,
    },

    // Skeletons
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
    skeletonGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    skeletonGridItem: {
      gap: spacing.sm,
    },
  });
