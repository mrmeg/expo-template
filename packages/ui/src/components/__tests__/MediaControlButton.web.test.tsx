/**
 * MediaControlButton on web: react-native-web ignores `hitSlop`, so a
 * transparent extender inside the drawn circle brings it to 44 pt in both
 * axes. `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { MediaControlButton, type MediaControlButtonSize } from "../MediaControlButton";

const HIT = "media-control-hit-target";
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
const insets = () => {
  const s = flat(screen.getByTestId(HIT, { includeHiddenElements: true }));
  return { top: s.top, bottom: s.bottom, left: s.left, right: s.right };
};

describe("MediaControlButton (web)", () => {
  // react-native-web does not map accessibilityState, so a toggle needs aria-pressed.
  it("states a toggle with aria-pressed, and leaves it off a plain button", async () => {
    const { rerender } = await render(<MediaControlButton icon="volume-x" accessibilityLabel="Mute" selected />);
    expect(screen.getByRole("button").props["aria-pressed"]).toBe(true);

    await rerender(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" selected={false} />);
    expect(screen.getByRole("button").props["aria-pressed"]).toBe(false);

    await rerender(<MediaControlButton icon="play" accessibilityLabel="Play" />);
    expect(screen.getByRole("button").props["aria-pressed"]).toBeUndefined();
  });

  it("is named by its accessibilityLabel", async () => {
    await render(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" />);

    // react-native-web's `createDOMProps` writes this prop as the DOM `aria-label`.
    expect(screen.getByRole("button", { name: "Mute" }).props.accessibilityLabel).toBe("Mute");
  });

  it("hides the glyph with aria-hidden", async () => {
    await render(<MediaControlButton icon="volume-2" accessibilityLabel="Mute" />);

    expect(screen.getByTestId("icon-volume-2", { includeHiddenElements: true }).props["aria-hidden"]).toBe(true);
  });

  it.each<[MediaControlButtonSize, number, number]>([
    ["sm", 32, -6],
    ["md", 40, -2],
  ])("size %s extends the hit extender to 44 pt in both axes", async (size, diameter, slop) => {
    await render(<MediaControlButton icon="x" size={size} accessibilityLabel="Close" />);

    const hit = screen.getByTestId(HIT, { includeHiddenElements: true });
    expect(flat(hit).position).toBe("absolute");
    expect(insets()).toEqual({ top: slop, bottom: slop, left: slop, right: slop });
    expect(diameter - 2 * slop).toBe(44);
  });

  it("size lg is already past 44, so it renders no extender", async () => {
    await render(<MediaControlButton icon="x" size="lg" accessibilityLabel="Close" />);

    expect(screen.queryByTestId(HIT, { includeHiddenElements: true })).toBeNull();
  });

  it("a caller hitSlop replaces the default extender", async () => {
    await render(<MediaControlButton icon="x" hitSlop={10} accessibilityLabel="Close" />);

    expect(insets()).toEqual({ top: -10, bottom: -10, left: -10, right: -10 });
  });

  it("hitSlop={0} opts out of the extender", async () => {
    await render(<MediaControlButton icon="x" hitSlop={0} accessibilityLabel="Close" />);

    expect(screen.queryByTestId(HIT, { includeHiddenElements: true })).toBeNull();
  });

  it("shows the kit's focus ring on keyboard focus only", async () => {
    await render(<MediaControlButton icon="x" accessibilityLabel="Close" />);

    const ring = (el: TestInstance) => typeof flat(el).boxShadow === "string";
    expect(ring(screen.getByRole("button"))).toBe(false);

    await fireEvent(screen.getByRole("button"), "focus", { nativeEvent: { target: { matches: () => false } } });
    expect(ring(screen.getByRole("button"))).toBe(false);

    await fireEvent(screen.getByRole("button"), "focus", { nativeEvent: { target: { matches: () => true } } });
    expect(ring(screen.getByRole("button"))).toBe(true);

    await fireEvent(screen.getByRole("button"), "blur", {});
    expect(ring(screen.getByRole("button"))).toBe(false);
  });
});
