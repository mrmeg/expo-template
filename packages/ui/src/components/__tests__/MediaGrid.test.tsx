/**
 * MediaGrid: the pure layout math, then the list around it: it seeds from the
 * window width, re-measures from its own layout (remounting on a new column
 * count), hands `renderTile` the tile size, and passes the rest of the
 * `FlatList` props through.
 */
import React from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { spacing } from "../../constants/spacing";
import { MediaGrid, mediaGridLayout } from "../MediaGrid";

let mockWindowWidth = 390;
jest.mock("../../hooks/useDimensions", () => ({
  useDimensions: () => ({ width: mockWindowWidth, height: 800 }),
}));

describe("mediaGridLayout", () => {
  it("lays a phone out as two columns of square tiles that fill the inset column", () => {
    // 390 - 2 * 16 = 358 wide; one 8 pt gap: (358 - 8) / 2.
    expect(mediaGridLayout(390)).toEqual({ columns: 2, tileSize: 175 });
  });

  it("adds columns as tiles of at least minTileWidth fit", () => {
    // 700 - 32 = 668: (668 + 8) / (160 + 8) = 4.02 columns.
    expect(mediaGridLayout(700).columns).toBe(4);
    // 2 * 160 + 8 + 32 = 360 is the narrowest width for two columns; three need 528.
    expect(mediaGridLayout(527).columns).toBe(2);
    expect(mediaGridLayout(528).columns).toBe(3);
  });

  it("never lets a row overflow the column", () => {
    for (const width of [320, 375, 390, 428, 600, 768, 1024, 1280, 1920]) {
      const { columns, tileSize } = mediaGridLayout(width);
      const column = Math.min(width, 960) - spacing.screenPadding * 2;
      expect(tileSize * columns + spacing.sm * (columns - 1)).toBeLessThanOrEqual(column);
    }
  });

  it("caps the column at maxWidth", () => {
    expect(mediaGridLayout(2400)).toEqual(mediaGridLayout(960));
    // 960 - 32 = 928 wide: five columns, (928 - 4 * 8) / 5.
    expect(mediaGridLayout(960)).toEqual({ columns: 5, tileSize: 179 });
    expect(mediaGridLayout(2400, { maxWidth: 600 }).columns).toBe(mediaGridLayout(600).columns);
  });

  it("honors minColumns however narrow the list", () => {
    expect(mediaGridLayout(200).columns).toBe(2);
    expect(mediaGridLayout(200, { minColumns: 3 }).columns).toBe(3);
    expect(mediaGridLayout(390, { minColumns: 1 }).columns).toBe(2);
    expect(mediaGridLayout(300, { minColumns: 1 }).columns).toBe(1);
  });

  it("treats a fractional or non-positive minColumns as at least one column", () => {
    expect(mediaGridLayout(300, { minColumns: 0 }).columns).toBe(1);
    expect(mediaGridLayout(300, { minColumns: 1.9 }).columns).toBe(1);
  });

  it("takes minTileWidth, gap and inset", () => {
    // 400 - 0 = 400 wide, 100 pt tiles, no gap: four of 100.
    expect(mediaGridLayout(400, { minTileWidth: 100, gap: 0, inset: 0 })).toEqual({ columns: 4, tileSize: 100 });
    // 400 - 2 * 20 = 360, 100 pt tiles, 10 pt gaps: (360 + 10) / 110 = 3.36 columns, (360 - 20) / 3.
    expect(mediaGridLayout(400, { minTileWidth: 100, gap: 10, inset: 20 })).toEqual({ columns: 3, tileSize: 113 });
  });

  it("never returns a negative tile size or a NaN, for a zero, tiny or invalid width", () => {
    for (const width of [0, 10, -50, Number.NaN, Number.POSITIVE_INFINITY * 0]) {
      const { columns, tileSize } = mediaGridLayout(width);
      expect(columns).toBe(2);
      expect(tileSize).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(tileSize)).toBe(false);
    }
    expect(mediaGridLayout(0).tileSize).toBe(0);
  });
});

interface Photo {
  key: string;
}

const photos = (count: number): Photo[] => Array.from({ length: count }, (_, i) => ({ key: `p${i}` }));

const hostTiles = () => screen.queryAllByTestId("tile", { includeHiddenElements: true });

/** How many tiles share a row with the first one, found by climbing to the row the grid's column wrapper styles. */
function tilesInFirstRow(): number {
  let node: TestInstance | null = hostTiles()[0].parent;
  while (node) {
    const style = StyleSheet.flatten(node.props.style) as Record<string, unknown> | undefined;
    if (style?.flexDirection === "row" && style.gap !== undefined) return node.children.length;
    node = node.parent;
  }
  return 1;
}

const renderTile = jest.fn(({ item, size }: { item: Photo; size: number }) => (
  <View testID="tile" style={{ width: size, height: size }}>
    <Text>{item.key}</Text>
  </View>
));

const layOut = (width: number, testID = "grid") =>
  act(async () => {
    screen.getByTestId(testID, { includeHiddenElements: true }).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } },
    } as LayoutChangeEvent);
  });

describe("MediaGrid", () => {
  beforeEach(() => {
    mockWindowWidth = 390;
    renderTile.mockClear();
  });

  it("seeds the tile size from the window width before it has measured", async () => {
    await render(<MediaGrid data={photos(4)} keyExtractor={(p) => p.key} renderTile={renderTile} testID="grid" />);

    expect(renderTile).toHaveBeenCalled();
    expect(renderTile.mock.calls.every(([info]) => info.size === 175)).toBe(true);
    expect(tilesInFirstRow()).toBe(2);
  });

  it("hands renderTile the item and its index", async () => {
    await render(<MediaGrid data={photos(3)} keyExtractor={(p) => p.key} renderTile={renderTile} testID="grid" />);

    expect(renderTile).toHaveBeenCalledWith(expect.objectContaining({ item: { key: "p2" }, index: 2 }));
    expect(screen.getByText("p0")).toBeTruthy();
  });

  it("re-measures from its own layout, with a new column count and tile size", async () => {
    await render(<MediaGrid data={photos(10)} keyExtractor={(p) => p.key} renderTile={renderTile} testID="grid" />);
    expect(tilesInFirstRow()).toBe(2);

    // 1000 is capped at 960: five columns of 179.
    renderTile.mockClear();
    await layOut(1000);

    expect(tilesInFirstRow()).toBe(5);
    expect(renderTile.mock.calls.every(([info]) => info.size === 179)).toBe(true);
  });

  it("follows the measured width over the window width", async () => {
    mockWindowWidth = 1280;
    await render(<MediaGrid data={photos(10)} keyExtractor={(p) => p.key} renderTile={renderTile} testID="grid" />);
    expect(tilesInFirstRow()).toBe(5);

    await layOut(390);

    expect(tilesInFirstRow()).toBe(2);
  });

  it("renders one column without a column wrapper when minColumns is 1", async () => {
    await render(
      <MediaGrid
        data={photos(3)}
        keyExtractor={(p) => p.key}
        renderTile={renderTile}
        minColumns={1}
        testID="grid"
      />,
    );
    await layOut(300);

    expect(hostTiles()).toHaveLength(3);
    expect(tilesInFirstRow()).toBe(1);
  });

  it("takes minTileWidth, gap and maxWidth", async () => {
    await render(
      <MediaGrid
        data={photos(8)}
        keyExtractor={(p) => p.key}
        renderTile={renderTile}
        minTileWidth={100}
        gap={4}
        maxWidth={500}
        testID="grid"
      />,
    );
    await layOut(900);

    // 500 - 32 = 468: (468 + 4) / 104 = 4.5 columns, (468 - 12) / 4.
    expect(tilesInFirstRow()).toBe(4);
    expect(renderTile.mock.calls.at(-1)?.[0].size).toBe(114);
  });

  it("passes FlatList props through, merges contentContainerStyle and chains onLayout", async () => {
    const onLayout = jest.fn();
    await render(
      <MediaGrid
        data={photos(0)}
        keyExtractor={(p) => p.key}
        renderTile={renderTile}
        testID="grid"
        onLayout={onLayout}
        contentContainerStyle={{ paddingBottom: 99 }}
        ListEmptyComponent={<Text>Nothing here</Text>}
        ListHeaderComponent={<Text>Header</Text>}
      />,
    );
    await layOut(500);

    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Header")).toBeTruthy();
    expect(onLayout).toHaveBeenCalledTimes(1);

    const content = StyleSheet.flatten(screen.getByTestId("grid").props.contentContainerStyle);
    expect(content).toMatchObject({
      paddingBottom: 99,
      paddingHorizontal: spacing.screenPadding,
      maxWidth: 960,
      alignSelf: "center",
    });
  });
});
