/**
 * IconButton on web: `aria-label` names the button, the glyph is `aria-hidden`,
 * and the transparent hit extender (react-native-web ignores `hitSlop`) brings
 * the drawn square to 44pt in both axes. `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";
import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { buttonHeights, type ButtonSize } from "../Button";
import { IconButton } from "../IconButton";

const HIT = "button-hit-target";
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
const hit = () => screen.getByTestId(HIT, { includeHiddenElements: true });
const insets = () => {
  const s = flat(hit());
  return { top: s.top, bottom: s.bottom, left: s.left, right: s.right };
};

describe("IconButton (web)", () => {
  it("is named by its accessibilityLabel", async () => {
    await render(<IconButton icon="check" accessibilityLabel="Refresh media" />);

    const button = screen.getByRole("button", { name: "Refresh media" });
    // Jest renders React Native's hosts; react-native-web's `createDOMProps` writes this
    // prop as the DOM `aria-label` (checked in a browser, not here).
    expect(button.props.accessibilityLabel).toBe("Refresh media");
  });

  it("hides the inner icon with aria-hidden", async () => {
    await render(<IconButton icon="check" accessibilityLabel="Refresh media" />);

    const icon = screen.getByTestId("icon-check", { includeHiddenElements: true });
    expect(icon.props["aria-hidden"]).toBe(true);
  });

  it.each<[ButtonSize, number]>([
    ["sm", -8],
    ["md", -6],
    ["lg", -2],
  ])("size %s extends the hit extender to 44pt in both axes", async (size, slop) => {
    await render(<IconButton icon="x" size={size} accessibilityLabel="Close" />);

    expect(flat(hit()).position).toBe("absolute");
    expect(insets()).toEqual({ top: slop, bottom: slop, left: slop, right: slop });
    // The square is height wide, so extending each side by -slop reaches 44.
    expect(buttonHeights[size] - 2 * slop).toBe(44);
  });

  it("an outline IconButton adds its border back, so the extender still spans 44pt", async () => {
    await render(<IconButton icon="x" preset="outline" accessibilityLabel="Close" />);

    expect(insets()).toEqual({ top: -7, bottom: -7, left: -7, right: -7 });
  });

  it("a caller hitSlop replaces the default extender", async () => {
    await render(<IconButton icon="x" hitSlop={10} accessibilityLabel="Close" />);

    expect(insets()).toEqual({ top: -10, bottom: -10, left: -10, right: -10 });
  });

  it("fires onPress", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="x" accessibilityLabel="Close" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
