import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, type FlatListProps, type LayoutChangeEvent, type ListRenderItemInfo } from "react-native";
import { spacing } from "../constants/spacing";
import { useDimensions } from "../hooks/useDimensions";

/** Defaults for `mediaGridLayout`. Phones get two columns, wide screens as many as fit. */
export const MEDIA_GRID_DEFAULTS = {
  minTileWidth: 160,
  gap: spacing.sm,
  minColumns: 2,
  maxWidth: 960,
  inset: spacing.screenPadding,
} as const;

export interface MediaGridLayoutOptions {
  /** Narrowest a tile may get before another column is dropped. @default 160 */
  minTileWidth?: number;
  /** Space between tiles, across and down the columns. @default spacing.sm */
  gap?: number;
  /** Fewest columns, however narrow the list. @default 2 */
  minColumns?: number;
  /** Widest the grid's column grows; wider lists center it. @default 960 */
  maxWidth?: number;
  /** Horizontal padding on each side of the column. @default spacing.screenPadding */
  inset?: number;
}

export interface MediaGridLayout {
  /** Number of columns. At least `minColumns` (and 1). */
  columns: number;
  /** Edge of each square tile, in points, rounded down so a row never overflows. Never negative. */
  tileSize: number;
}

/**
 * Columns and tile size for a list `width` (capped at `maxWidth`, less the
 * inset on both sides). Pure, so a screen can size things outside the grid with
 * it too.
 *
 * ```ts
 * mediaGridLayout(390);  // { columns: 2, tileSize: 175 }
 * mediaGridLayout(1280); // { columns: 5, tileSize: 179 }
 * ```
 */
export function mediaGridLayout(width: number, options: MediaGridLayoutOptions = {}): MediaGridLayout {
  const {
    minTileWidth = MEDIA_GRID_DEFAULTS.minTileWidth,
    gap = MEDIA_GRID_DEFAULTS.gap,
    minColumns = MEDIA_GRID_DEFAULTS.minColumns,
    maxWidth = MEDIA_GRID_DEFAULTS.maxWidth,
    inset = MEDIA_GRID_DEFAULTS.inset,
  } = options;
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const column = Math.max(0, Math.min(safeWidth, maxWidth) - inset * 2);
  const floor = Math.max(1, Math.floor(minColumns));
  const columns = Math.max(floor, Math.floor((column + gap) / (minTileWidth + gap)));
  const tileSize = Math.max(0, Math.floor((column - gap * (columns - 1)) / columns));
  return { columns, tileSize };
}

/**
 * The layout for a list that measures itself: the window width seeds it until
 * the list reports its own (it is narrower beside a web nav rail). Spread
 * `onLayout` on the scrolling list, and key the list on `columns`, since a
 * `FlatList` cannot change `numColumns` while mounted. `MediaGrid` does all of
 * this; use the hook to build a grid of your own.
 */
export function useMediaGridLayout(options: MediaGridLayoutOptions = {}): MediaGridLayout & {
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const { minTileWidth, gap, minColumns, maxWidth, inset } = options;
  const { width: windowWidth } = useDimensions();
  const [listWidth, setListWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setListWidth(event.nativeEvent.layout.width);
  }, []);
  const { columns, tileSize } = useMemo(
    () => mediaGridLayout(listWidth || windowWidth, { minTileWidth, gap, minColumns, maxWidth, inset }),
    [listWidth, windowWidth, minTileWidth, gap, minColumns, maxWidth, inset],
  );
  return { columns, tileSize, onLayout };
}

/** What `renderTile` receives. */
export interface MediaGridTileInfo<T> {
  item: T;
  index: number;
  /** Edge of the square tile to draw, in points. Hand it to `MediaTile`'s `size`. */
  size: number;
}

export interface MediaGridProps<T>
  extends Omit<
    FlatListProps<T>,
    "data" | "renderItem" | "keyExtractor" | "numColumns" | "columnWrapperStyle" | "horizontal"
  > {
  /** The items, one tile each. */
  data: readonly T[];
  /** A stable, unique key per item. */
  keyExtractor: (item: T, index: number) => string;
  /** Draws one tile, usually a `MediaTile` with `size={size}`. */
  renderTile: (info: MediaGridTileInfo<T>) => React.ReactElement | null;
  /** Narrowest a tile may get before a column is dropped. @default 160 */
  minTileWidth?: number;
  /** Space between tiles across a row. @default spacing.sm */
  gap?: number;
  /** Space between rows, which leaves room for a tile's title lines. @default spacing.md */
  rowGap?: number;
  /** Fewest columns, however narrow the list. @default 2 */
  minColumns?: number;
  /** Widest the column grows; wider lists center it. @default 960 */
  maxWidth?: number;
  /** Reaches the underlying `FlatList`. React 19 passes `ref` as a prop. */
  ref?: React.Ref<FlatList<T>>;
}

/**
 * MediaGrid
 *
 * A `FlatList` of square tiles that fills the width: as many columns as fit
 * `minTileWidth` (two on a phone), tiles sized to the column, the column capped
 * at `maxWidth` and centered with the screen's 16 pt inset on each side. The
 * grid measures itself, seeds from the window width until it has, and remounts
 * when the column count changes, because `numColumns` cannot change on a
 * mounted list.
 *
 * Every other `FlatList` prop passes through: `refreshControl`,
 * `ListHeaderComponent`, `ListEmptyComponent`, `extraData` (pass the selection
 * so tiles redraw when it changes), `testID`, and so on. `contentContainerStyle`
 * merges over the grid's own, and `onLayout` runs after the grid's.
 *
 * Presentational and generic over the item type; it knows nothing about what
 * the tiles show. Pair it with `MediaTile`.
 *
 * @example
 * ```tsx
 * <MediaGrid
 *   data={photos}
 *   keyExtractor={(photo) => photo.key}
 *   extraData={selection.selected}
 *   renderTile={({ item, size }) => (
 *     <MediaTile id={item.key} kind="image" source={{ uri: item.url }} size={size} title={item.name} />
 *   )}
 * />
 * ```
 */
export function MediaGrid<T>({
  data,
  keyExtractor,
  renderTile,
  minTileWidth,
  gap = MEDIA_GRID_DEFAULTS.gap,
  rowGap = spacing.md,
  minColumns,
  maxWidth = MEDIA_GRID_DEFAULTS.maxWidth,
  contentContainerStyle,
  onLayout,
  ref,
  ...rest
}: MediaGridProps<T>) {
  const { columns, tileSize, onLayout: measure } = useMediaGridLayout({ minTileWidth, gap, minColumns, maxWidth });

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      measure(event);
      onLayout?.(event);
    },
    [measure, onLayout],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => renderTile({ item, index, size: tileSize }),
    [renderTile, tileSize],
  );

  // Dynamic by prop, so inline rather than registered; plain objects serialize
  // into the server markup as-is.
  const content = useMemo(
    () => ({
      width: "100%" as const,
      maxWidth,
      alignSelf: "center" as const,
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: rowGap,
    }),
    [maxWidth, rowGap],
  );
  const columnWrapper = useMemo(() => ({ gap }), [gap]);

  return (
    <FlatList<T>
      {...rest}
      // numColumns can't change on a mounted list; a new key remounts it.
      key={`media-grid-${columns}`}
      ref={ref}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={columns}
      // `columnWrapperStyle` throws on a single-column list.
      columnWrapperStyle={columns > 1 ? columnWrapper : undefined}
      onLayout={handleLayout}
      contentContainerStyle={StyleSheet.flatten([content, contentContainerStyle])}
    />
  );
}
