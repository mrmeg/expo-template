/**
 * MediaTile: which controls render, what each callback receives, the labels,
 * the picture it hands `Image`, and the fallback and ring overlays.
 *
 * `expo-image` is replaced by a `View` that receives every prop.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MediaTile, type MediaTileProps } from "../MediaTile";

const mockImageRender = jest.fn();
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => {
      mockImageRender();
      return createElement(View, { ...props, testID: "expo-image" });
    },
  };
});

const SOURCE = { uri: "https://example.com/a.jpg?sig=1", cacheKey: "photos/a.jpg" };

const renderTile = (props: Partial<MediaTileProps> = {}) =>
  render(<MediaTile id="photos/a.jpg" kind="image" size={160} title="Beach" source={SOURCE} testID="tile" {...props} />);

const picture = () => screen.queryByTestId("expo-image", { includeHiddenElements: true });
const frame = () => screen.queryByTestId("tile-image", { includeHiddenElements: true });
const ring = () => screen.queryByTestId("media-tile-ring", { includeHiddenElements: true });

describe("MediaTile", () => {
  beforeEach(() => mockImageRender.mockClear());

  describe("memoization", () => {
    const tile = (source: { uri: string; cacheKey?: string }, onPress?: () => void) => (
      <MediaTile id="a" kind="image" size={160} title="Beach" source={source} onPress={onPress} testID="tile" />
    );

    it("skips re-rendering for an equal but new source object", async () => {
      const onPress = jest.fn();
      const { rerender } = await render(tile({ uri: SOURCE.uri, cacheKey: SOURCE.cacheKey }, onPress));
      const rendered = mockImageRender.mock.calls.length;

      await rerender(tile({ uri: SOURCE.uri, cacheKey: SOURCE.cacheKey }, onPress));

      expect(mockImageRender).toHaveBeenCalledTimes(rendered);
    });

    it("re-renders when the picture, a callback or any other prop changes", async () => {
      const onPress = jest.fn();
      const { rerender } = await render(tile(SOURCE, onPress));
      let rendered = mockImageRender.mock.calls.length;

      await rerender(tile({ uri: "https://example.com/b.jpg", cacheKey: SOURCE.cacheKey }, onPress));
      expect(mockImageRender.mock.calls.length).toBeGreaterThan(rendered);
      rendered = mockImageRender.mock.calls.length;

      await rerender(tile({ uri: "https://example.com/b.jpg", cacheKey: "other" }, onPress));
      expect(mockImageRender.mock.calls.length).toBeGreaterThan(rendered);
      rendered = mockImageRender.mock.calls.length;

      await rerender(tile({ uri: "https://example.com/b.jpg", cacheKey: "other" }, jest.fn()));
      expect(mockImageRender.mock.calls.length).toBeGreaterThan(rendered);
    });

    it("re-renders when a prop is added or removed", async () => {
      const { rerender } = await render(tile(SOURCE));
      expect(screen.queryByLabelText("Open Beach")).toBeNull();

      await rerender(tile(SOURCE, jest.fn()));

      expect(screen.getByLabelText("Open Beach")).toBeTruthy();
    });
  });

  it("draws the picture with its cache key, cover fit and the tile's size", async () => {
    await renderTile();

    const image = picture();
    expect(image?.props.source).toEqual({ uri: SOURCE.uri, cacheKey: SOURCE.cacheKey });
    expect(image?.props.contentFit).toBe("cover");
    expect(image?.props.recyclingKey).toBe("photos/a.jpg");
    expect(StyleSheet.flatten(frame()?.props.style)).toMatchObject({ width: 160, height: 160 });
  });

  it("draws a require()d asset as it is, and memoizes on its id", async () => {
    const { rerender } = await renderTile({ source: 7 });
    expect(picture()?.props.source).toBe(7);
    const rendered = mockImageRender.mock.calls.length;

    await rerender(<MediaTile id="photos/a.jpg" kind="image" size={160} title="Beach" source={7} testID="tile" />);
    expect(mockImageRender).toHaveBeenCalledTimes(rendered);

    await rerender(<MediaTile id="photos/a.jpg" kind="image" size={160} title="Beach" source={8} testID="tile" />);
    expect(mockImageRender.mock.calls.length).toBeGreaterThan(rendered);
  });

  it("shows the title and subtitle on one line each", async () => {
    await renderTile({ subtitle: "1.2 MB" });

    expect(screen.getByText("Beach").props.numberOfLines).toBe(1);
    expect(screen.getByText("1.2 MB").props.numberOfLines).toBe(1);
  });

  it("omits the text lines when there is no title or subtitle", async () => {
    await renderTile({ title: undefined });

    expect(screen.queryByText("Beach")).toBeNull();
  });

  describe("press", () => {
    it("calls onPress with the id when an image tile is pressed", async () => {
      const onPress = jest.fn();
      await renderTile({ onPress });

      await fireEvent.press(screen.getByLabelText("Open Beach"));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith("photos/a.jpg");
    });

    it("is not interactive without onPress", async () => {
      await renderTile();

      expect(screen.queryByLabelText("Open Beach")).toBeNull();
      expect(screen.queryByLabelText("Play Beach")).toBeNull();
    });

    it("calls onPress with the id from a video's play button, and not from an open target", async () => {
      const onPress = jest.fn();
      await renderTile({ id: "clip", kind: "video", title: "Clip", onPress });

      expect(screen.queryByLabelText("Open Clip")).toBeNull();
      await fireEvent.press(screen.getByLabelText("Play Clip"));

      expect(onPress).toHaveBeenCalledWith("clip");
    });

    it("shows no play button on a video without onPress", async () => {
      await renderTile({ kind: "video", title: "Clip" });

      expect(screen.queryByLabelText("Play Clip")).toBeNull();
    });

    it("makes a file tile pressable", async () => {
      const onPress = jest.fn();
      await renderTile({ id: "doc", kind: "file", title: "Report", source: undefined, onPress });

      await fireEvent.press(screen.getByLabelText("Open Report"));

      expect(onPress).toHaveBeenCalledWith("doc");
    });
  });

  describe("optional controls", () => {
    it("renders the checkbox chip only with onToggleSelect, and passes the id", async () => {
      const onToggleSelect = jest.fn();
      const { unmount } = await renderTile();
      expect(screen.queryByRole("checkbox")).toBeNull();
      await unmount();

      await renderTile({ onToggleSelect });
      await fireEvent.press(screen.getByLabelText("Select Beach"));

      expect(onToggleSelect).toHaveBeenCalledWith("photos/a.jpg");
    });

    it("reflects selected on the checkbox and draws the ring only when selected", async () => {
      const { rerender } = await renderTile({ onToggleSelect: jest.fn() });
      expect(ring()).toBeNull();
      expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false);

      await rerender(
        <MediaTile id="photos/a.jpg" kind="image" size={160} title="Beach" source={SOURCE} onToggleSelect={jest.fn()} selected />,
      );

      expect(ring()).not.toBeNull();
      expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true);
    });

    it("keeps the picture's size when selected", async () => {
      await renderTile({ selected: true });

      expect(StyleSheet.flatten(frame()?.props.style)).toMatchObject({ width: 160, height: 160 });
    });

    it("renders the delete chip only with onDelete, and passes the id", async () => {
      const onDelete = jest.fn();
      const { unmount } = await renderTile();
      expect(screen.queryByLabelText("Delete Beach")).toBeNull();
      await unmount();

      await renderTile({ onDelete });
      await fireEvent.press(screen.getByLabelText("Delete Beach"));

      expect(onDelete).toHaveBeenCalledWith("photos/a.jpg");
    });

    it("draws the delete icon the caller names", async () => {
      await renderTile({ onDelete: jest.fn(), deleteIcon: "circle-alert" });

      expect(screen.queryByTestId("icon-circle-alert", { includeHiddenElements: true })).not.toBeNull();
      expect(screen.queryByTestId("icon-x", { includeHiddenElements: true })).toBeNull();
    });

    it("blocks every control while disabled", async () => {
      const onPress = jest.fn();
      const onToggleSelect = jest.fn();
      const onDelete = jest.fn();
      await renderTile({ onPress, onToggleSelect, onDelete, disabled: true });

      await fireEvent.press(screen.getByLabelText("Open Beach"));
      await fireEvent.press(screen.getByLabelText("Select Beach"));
      await fireEvent.press(screen.getByLabelText("Delete Beach"));

      expect(onPress).not.toHaveBeenCalled();
      expect(onToggleSelect).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("labels", () => {
    it("names controls after accessibilityLabel before title", async () => {
      await renderTile({ accessibilityLabel: "Sunset.jpg", onPress: jest.fn(), onToggleSelect: jest.fn(), onDelete: jest.fn() });

      expect(screen.getByLabelText("Open Sunset.jpg")).toBeTruthy();
      expect(screen.getByLabelText("Select Sunset.jpg")).toBeTruthy();
      expect(screen.getByLabelText("Delete Sunset.jpg")).toBeTruthy();
    });

    it("falls back to the kind when there is no title or label", async () => {
      await renderTile({ title: undefined, onPress: jest.fn() });

      expect(screen.getByLabelText("Open image")).toBeTruthy();
    });

    it("takes localized label builders", async () => {
      await renderTile({
        onPress: jest.fn(),
        onToggleSelect: jest.fn(),
        onDelete: jest.fn(),
        openLabel: (name) => `Abrir ${name}`,
        selectLabel: (name) => `Elegir ${name}`,
        deleteLabel: (name) => `Borrar ${name}`,
      });

      expect(screen.getByLabelText("Abrir Beach")).toBeTruthy();
      expect(screen.getByLabelText("Elegir Beach")).toBeTruthy();
      expect(screen.getByLabelText("Borrar Beach")).toBeTruthy();
    });

    it("takes a localized play label", async () => {
      await renderTile({ kind: "video", onPress: jest.fn(), playLabel: (name) => `Reproducir ${name}` });

      expect(screen.getByLabelText("Reproducir Beach")).toBeTruthy();
    });

    it("describes the picture to assistive technology only when the tile is not pressable", async () => {
      const { unmount } = await renderTile();
      expect(frame()?.props.accessibilityLabel).toBe("Beach");
      await unmount();

      await renderTile({ onPress: jest.fn() });
      expect(frame()?.props.accessibilityLabel).toBeUndefined();
    });
  });

  describe("without a source", () => {
    it("draws the image-off icon instead of a picture", async () => {
      await renderTile({ source: undefined });

      expect(picture()).toBeNull();
      expect(screen.queryByTestId("icon-image-off", { includeHiddenElements: true })).not.toBeNull();
    });

    it("draws play for a video, and the caller's glyph when given", async () => {
      const { unmount } = await renderTile({ kind: "video", source: undefined });
      expect(screen.queryByTestId("icon-play", { includeHiddenElements: true })).not.toBeNull();
      await unmount();

      await renderTile({ kind: "file", source: undefined, fallbackIcon: "monitor" });
      expect(screen.queryByTestId("icon-monitor", { includeHiddenElements: true })).not.toBeNull();
    });
  });
});
