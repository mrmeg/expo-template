/**
 * MediaControlButton: the icon-only overlay control for chrome drawn over
 * video and images. iOS is the jest-expo default; web has its own file.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { MediaControlButton, type MediaControlButtonSize } from "../MediaControlButton";
import * as componentsBarrel from "../index";

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

/** `Pressable`'s style is a function of its press state; Jest hosts carry the resolved style. */
const button = (name = "Mute") => screen.getByRole("button", { name });

describe("MediaControlButton", () => {
  // A centered overlay (Video's center play button, its error retry) relies on
  // the parent's alignItems; a self-alignment here pinned them to the left edge.
  it("leaves its alignment to the parent", async () => {
    await render(<MediaControlButton icon="play" accessibilityLabel="Play" />);
    expect(flat(screen.getByRole("button")).alignSelf).toBeUndefined();
  });

  it("is a button named by its accessibilityLabel", async () => {
    await render(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" />);

    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
  });

  it("hides the glyph from assistive tech, so the label is the only name", async () => {
    await render(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" />);

    const icon = screen.getByTestId("icon-volume-2", { includeHiddenElements: true });
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("draws the glyph white", async () => {
    await render(<MediaControlButton icon="play" accessibilityLabel="Play" />);

    expect(screen.getByTestId("icon-play", { includeHiddenElements: true }).props.color).toBe("#FFFFFF");
  });

  it("sets accessibilityState.selected from `selected`", async () => {
    const { rerender } = await render(
      <MediaControlButton icon="volume-x" accessibilityLabel="Mute" selected />,
    );
    expect(button().props.accessibilityState).toEqual(expect.objectContaining({ selected: true, disabled: false }));

    await rerender(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" selected={false} />);
    expect(button().props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));

    await rerender(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" />);
    expect(button().props.accessibilityState.selected).toBeUndefined();
  });

  it("fires onPress", async () => {
    const onPress = jest.fn();
    await render(<MediaControlButton icon="play" accessibilityLabel="Play" onPress={onPress} />);

    await fireEvent.press(button("Play"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks presses and announces disabled when disabled", async () => {
    const onPress = jest.fn();
    await render(<MediaControlButton icon="play" accessibilityLabel="Play" onPress={onPress} disabled />);

    await fireEvent.press(button("Play"));

    expect(onPress).not.toHaveBeenCalled();
    expect(button("Play").props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("drops the glyph opacity to 0.4 when disabled", async () => {
    const { rerender } = await render(<MediaControlButton icon="play" accessibilityLabel="Play" />);
    expect(flat(screen.getByTestId("icon-play", { includeHiddenElements: true }))).not.toHaveProperty("opacity");

    await rerender(<MediaControlButton icon="play" accessibilityLabel="Play" disabled />);
    expect(flat(screen.getByTestId("icon-play", { includeHiddenElements: true })).opacity).toBe(0.4);
  });

  it.each<[MediaControlButtonSize, number, number]>([
    ["sm", 32, 16],
    ["md", 40, 20],
    ["lg", 56, 28],
  ])("size %s draws a %i pt circle with a %i pt glyph", async (size, diameter, glyph) => {
    await render(<MediaControlButton icon="x" size={size} accessibilityLabel="Close" />);

    const style = flat(button("Close"));
    expect(style.width).toBe(diameter);
    expect(style.height).toBe(diameter);
    expect(style.borderRadius).toBe(diameter / 2);
    expect(flat(screen.getByTestId("icon-x", { includeHiddenElements: true }))).toEqual(
      expect.objectContaining({ width: glyph, height: glyph }),
    );
  });

  it("defaults to size md", async () => {
    await render(<MediaControlButton icon="x" accessibilityLabel="Close" />);

    expect(flat(button("Close")).width).toBe(40);
  });

  it("sits on a 45% black scrim", async () => {
    await render(<MediaControlButton icon="x" accessibilityLabel="Close" />);

    expect(flat(button("Close")).backgroundColor).toBe("rgba(0, 0, 0, 0.45)");
  });

  it("raises the scrim to 60% while pressed", async () => {
    await render(<MediaControlButton icon="x" accessibilityLabel="Close" />);

    // `Pressable` derives `pressed` from the responder lifecycle, not from `onPressIn`.
    const touch = { nativeEvent: { touches: [], changedTouches: [], target: 1, timestamp: 0 }, touchHistory: {}, currentTarget: 1, persist: () => {} };
    await fireEvent(button("Close"), "responderGrant", touch);
    expect(flat(button("Close")).backgroundColor).toBe("rgba(0, 0, 0, 0.6)");

    // Pressability holds the pressed state for its minimum press duration.
    await fireEvent(button("Close"), "responderRelease", touch);
    await waitFor(() => expect(flat(button("Close")).backgroundColor).toBe("rgba(0, 0, 0, 0.45)"));
  });

  it.each<[MediaControlButtonSize, number]>([
    ["sm", 32],
    ["md", 40],
    ["lg", 56],
  ])("size %s reaches a 44 pt hit area with a numeric hitSlop", async (size, diameter) => {
    await render(<MediaControlButton icon="x" size={size} accessibilityLabel="Close" />);

    const hitSlop = button("Close").props.hitSlop;
    expect(typeof hitSlop).toBe("number");
    expect(hitSlop).toBeGreaterThanOrEqual(0);
    expect(diameter + 2 * hitSlop).toBeGreaterThanOrEqual(44);
  });

  it("lets a caller hitSlop win, including 0", async () => {
    const { rerender } = await render(<MediaControlButton icon="x" hitSlop={12} accessibilityLabel="Close" />);
    expect(button("Close").props.hitSlop).toBe(12);

    await rerender(<MediaControlButton icon="x" hitSlop={0} accessibilityLabel="Close" />);
    expect(button("Close").props.hitSlop).toBe(0);
  });

  it("merges a caller style, including an array, without nesting it", async () => {
    await render(
      <MediaControlButton
        icon="x"
        accessibilityLabel="Close"
        style={[{ position: "absolute" }, { top: 8, right: 8 }]}
      />,
    );

    expect(flat(button("Close"))).toEqual(
      expect.objectContaining({ position: "absolute", top: 8, right: 8, width: 40 }),
    );
  });

  it("passes testID through", async () => {
    await render(<MediaControlButton icon="x" accessibilityLabel="Close" testID="video-close" />);

    expect(screen.getByTestId("video-close")).toBeTruthy();
  });

  it("is subpath-only: the components barrel does not export it", () => {
    expect(componentsBarrel).not.toHaveProperty("MediaControlButton");
  });

  describe("dev warning", () => {
    it("warns once per instance when the label is empty", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const { rerender } = await render(<MediaControlButton icon="x" accessibilityLabel="" />);
      await rerender(<MediaControlButton icon="x" accessibilityLabel="  " />);
      await rerender(<MediaControlButton icon="x" accessibilityLabel="" size="lg" />);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toBe(
        "MediaControlButton: `accessibilityLabel` is required; an icon-only button has no other accessible name.",
      );
    });

    it("does not warn when the label is set", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await render(<MediaControlButton icon="x" accessibilityLabel="Close" />);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
