# Spec: Search Results & Card Grid Screen Templates

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## Summary

Add two new screen templates to `client/screens/`: `SearchResultsScreen` for searchable, filterable list views, and `CardGridScreen` for responsive card grid layouts. Both use typed generics so consumers can pass any item type. These are the two most common "discovery" patterns missing from the template library.

---

## Motivation

The existing `ListScreen` covers basic searchable lists, but lacks filter chips, sort controls, grid/list toggle, and result counts. Many apps need a richer discovery experience -- search results pages, product catalogs, image galleries, article feeds. These two templates cover the majority of those use cases while staying generic via typed props.

---

## Deliverables

### A) SearchResultsScreen (`client/screens/SearchResultsScreen.tsx`)

A full-featured search results screen with filters, sorting, and view toggle.

#### Props Interface

```typescript
export interface SearchFilter {
  key: string;
  label: string;
  active?: boolean;
}

export interface SearchSortOption {
  value: string;
  label: string;
}

export interface SearchResultsScreenProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  renderGridItem?: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;

  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  initialQuery?: string;

  // Filters
  filters?: SearchFilter[];
  onFilterPress?: (filter: SearchFilter) => void;

  // Sort
  sortOptions?: SearchSortOption[];
  selectedSort?: string;
  onSortChange?: (value: string) => void;

  // View toggle
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  gridColumns?: number;                     // defaults to 2

  // Results info
  resultCount?: number;
  resultLabel?: string;                     // e.g. "results", "items" -- defaults to "results"

  // States
  loading?: boolean;
  skeletonCount?: number;                   // defaults to 6
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onPress: () => void };
  emptySuggestions?: string[];              // shown below empty description, e.g. "Try searching for..."

  // Refresh
  onRefresh?: () => void;
  refreshing?: boolean;

  // Layout
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- **Search input** at the top (sticky via `ListHeaderComponent`). Uses `TextInput` from UI components with search icon on the left (same pattern as ListScreen). Controlled via `onSearch` callback.
- **Filter chips row** below search. Horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}`. Each chip is a small pressable pill: `theme.colors.muted` background when inactive, `theme.colors.primary` background with `theme.colors.primaryForeground` text when active. Border radius `radiusMd`. Padding horizontal `spacing.md`, vertical `spacing.xs`. Text size 13px, fontWeight "500". Only renders if `filters` is provided and non-empty.
- **Toolbar row** below filters: left side shows result count (e.g. "42 results" in 13px `mutedForeground`), right side shows sort dropdown button + view toggle icons (list/grid). Sort button is a small pressable that shows the selected sort label with a chevron-down icon. Tapping it cycles through `sortOptions` or opens a simple bottom-anchored selection (implementer may use a Pressable that cycles through options on press for simplicity -- a full dropdown is not required). View toggle shows `list` and `grid` icons side by side; active icon uses `theme.colors.foreground`, inactive uses `theme.colors.mutedForeground`.
- **Results list** uses `FlatList` in list mode. In grid mode, uses `FlatList` with `numColumns={gridColumns}` and `renderGridItem` (falls back to `renderItem` if `renderGridItem` is not provided). `columnWrapperStyle` adds gap between grid columns.
- **Staggered entrance** on each item via `AnimatedView` with `fadeSlideUp` and capped stagger delay (same as ListScreen: `Math.min(index, 10) * STAGGER_DELAY`).
- **Empty state** renders centered with icon, title, description, optional action button, and optional suggestions list (rendered as small muted text chips/tags). Follows the ListScreen empty state pattern.
- **Loading state** renders skeleton items. In list mode: same skeleton rows as ListScreen. In grid mode: skeleton cards in a grid using `Skeleton` with card-like proportions (width fills column, height ~160).
- **Pull-to-refresh** via `RefreshControl` when `onRefresh` is provided.
- **Key constraint:** `FlatList` with `numColumns` requires a new `key` prop when `numColumns` changes. When `viewMode` switches between list and grid, the `FlatList` must use `key={viewMode}` to force remount.

#### Visual Layout (top to bottom)

```
[header (optional)]
[search input with icon]
[filter chips horizontal scroll (conditional)]
[toolbar: result count | sort + view toggle]
[FlatList results OR empty state OR skeleton loading]
```

### B) CardGridScreen (`client/screens/CardGridScreen.tsx`)

A responsive card grid with category tabs, sorting, and staggered entrance.

#### Props Interface

```typescript
export interface CardGridCategory {
  key: string;
  label: string;
}

export interface CardGridScreenProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;

  // Categories
  categories?: CardGridCategory[];
  selectedCategory?: string;
  onCategoryChange?: (key: string) => void;

  // Sort
  sortOptions?: SearchSortOption[];        // reuse from SearchResultsScreen or define inline
  selectedSort?: string;
  onSortChange?: (value: string) => void;

  // Grid
  columns?: number;                        // defaults to 2
  cardSpacing?: number;                    // defaults to spacing.md

  // Card press
  onCardPress?: (item: T, index: number) => void;

  // States
  loading?: boolean;
  skeletonCount?: number;                  // defaults to 6
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onPress: () => void };

  // Refresh
  onRefresh?: () => void;
  refreshing?: boolean;

  // Layout
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- **Category tabs** at top. Horizontal `ScrollView` with pill-style tabs. Selected tab: `theme.colors.primary` background, `theme.colors.primaryForeground` text. Unselected: transparent background, `theme.colors.mutedForeground` text. Each tab has horizontal padding `spacing.md`, vertical `spacing.xs`, border radius `radiusMd`. Text 14px, fontWeight "500". Only renders if `categories` is provided.
- **Sort row** below categories (if `sortOptions` provided). Right-aligned pressable showing selected sort label + chevron icon. Same pattern as SearchResultsScreen toolbar.
- **Card grid** via `FlatList` with `numColumns={columns}`. `columnWrapperStyle` sets gap between columns. `contentContainerStyle` sets horizontal padding and bottom padding. Each item wrapper applies flex sizing: `flex: 1, maxWidth: 1/columns as percentage`. The consumer's `renderCard` is responsible for card content -- this screen just handles the grid layout.
- **`onCardPress` convenience:** If provided, each card is wrapped in a `Pressable`. The consumer can use this instead of handling press in `renderCard`.
- **Staggered entrance** on each card via `AnimatedView` with `fadeSlideUp`, stagger capped at 10 items.
- **Loading skeleton** renders a grid of `SkeletonCard` components (from `@/client/components/ui/Skeleton`) matching the column count.
- **Empty state** centered, same pattern as ListScreen.
- **Pull-to-refresh** via `RefreshControl`.
- **Responsive columns:** The `columns` prop defaults to 2 but can be set by the consumer. Tablet/web consumers can pass 3 or more. The screen itself does not detect screen size -- that responsibility falls to the consumer (they can use `useDimensions` to compute the column count and pass it in).

#### Visual Layout (top to bottom)

```
[header (optional)]
[category tabs horizontal scroll (conditional)]
[sort row (conditional)]
[FlatList card grid OR empty state OR skeleton grid]
```

---

## Patterns to Follow

These patterns are mandatory -- they come directly from the existing screen templates:

1. **File structure:** Types section, Component section, Styles section -- each separated by `// ---------------------------------------------------------------------------` banners.
2. **Generics:** Both screens use `<T>` generic on the function and props interface (same pattern as `ListScreen<T>`).
3. **Theme:** `const { theme } = useTheme();` and `const styles = createStyles(theme);` with `createStyles` returning `StyleSheet.create(...)`.
4. **Imports:** `type Theme` from colors, `spacing` from constants, text components from StyledText, `AnimatedView` from UI components (for list item stagger), `Skeleton`/`SkeletonCard` for loading states.
5. **Animations:** Use `AnimatedView` with `type="fadeSlideUp"` and `delay={Math.min(index, 10) * STAGGER_DELAY}` for list/grid items (same as ListScreen). Import `STAGGER_DELAY` from `useStaggeredEntrance`.
6. **Style override:** Accept `style?: StyleProp<ViewStyle>`, apply as `[styles.container, styleOverride]`.
7. **Empty state:** Inline implementation following ListScreen pattern (icon circle, title, description, optional action button). Do NOT import `EmptyState` component -- follow the inline pattern for consistency with ListScreen.
8. **Loading state:** Inline skeleton rendering (not a separate component).
9. **Spacing:** Use `spacing.*` tokens exclusively, never raw numbers.
10. **Button/Icon:** Use components from `@/client/components/ui/`.
11. **FlatList:** Import from `react-native`. Use `contentContainerStyle`, `showsVerticalScrollIndicator={false}`, `RefreshControl` pattern from ListScreen.

---

## Shared Types

`SearchSortOption` is used by both screens. Options:
- Define it in `SearchResultsScreen.tsx` and have `CardGridScreen.tsx` import it from there.
- Or define it in both files independently (simpler, avoids cross-screen imports).

Prefer the second option -- keep screens independent, each defining their own types. The types are small (2 fields) and duplication is acceptable for portability.

---

## Out of Scope

- Actual sort/filter logic (consumer handles data transformation).
- Infinite scroll / pagination (consumer can append to `data`).
- Animated transitions between list and grid view modes.
- Screen-size-based responsive column calculation (consumer's responsibility).
- Full dropdown/popover for sort selection (simple press-to-cycle is sufficient).

---

## Testing Plan

### SearchResultsScreen

1. Renders with minimal props (data, renderItem, keyExtractor).
2. Search input renders when `onSearch` is provided, calls back on text change.
3. Filter chips render when `filters` is provided, active state visually distinct.
4. Sort and view toggle render in toolbar.
5. Grid mode sets `numColumns` on FlatList and uses `renderGridItem` when available.
6. Empty state renders when `data` is empty.
7. Loading skeleton renders when `loading` is true.
8. RefreshControl renders when `onRefresh` is provided.
9. Result count displays correctly.

### CardGridScreen

1. Renders with minimal props (data, renderCard, keyExtractor).
2. Category tabs render when `categories` is provided, selected tab is visually distinct.
3. Sort row renders when `sortOptions` is provided.
4. Grid renders with correct number of columns.
5. `onCardPress` wraps items in Pressable.
6. Empty state renders when `data` is empty.
7. Loading skeleton grid renders when `loading` is true.
8. RefreshControl renders when `onRefresh` is provided.

---

## Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `client/screens/SearchResultsScreen.tsx` |
| Create | `client/screens/CardGridScreen.tsx` |

---

## Estimated Effort

Medium -- two files, each ~250-350 lines. SearchResultsScreen is the more complex of the two due to the filter/sort/view-toggle toolbar. CardGridScreen is simpler since it reuses similar patterns.
