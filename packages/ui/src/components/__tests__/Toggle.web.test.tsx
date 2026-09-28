/**
 * On web, Toggle reaches a 44pt pointer target through the kit's transparent
 * hit extender inside its drawn box (react-native-web ignores `hitSlop`); the
 * drawn 32/36/40pt box does not change. `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";
import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
}));

jest.mock("../../hooks/useScalePress", () => ({
  useScalePress: () => ({ animatedStyle: {}, pressHandlers: { onPressIn: jest.fn(), onPressOut: jest.fn() } }),
}));

import { Toggle, ToggleIcon } from "../Toggle";

const HIT = "hit-target";
const flat = (el: TestInstance) => StyleSheet.flatten(el.props.style) as Record<string, unknown>;
const hit = () => screen.getByTestId(HIT, { includeHiddenElements: true });
const insets = () => {
  const s = flat(hit());
  return { top: s.top, bottom: s.bottom, left: s.left, right: s.right };
};

describe("Toggle pointer target (web)", () => {
  it.each([
    ["sm", -7],
    ["default", -5],
    ["lg", -3],
  ] as const)("size %s extends the target to 44pt vertically, border included", async (size, slop) => {
    await render(
      <Toggle size={size} pressed={false} onPressedChange={() => {}} accessibilityLabel="Bold">
        <ToggleIcon name="bold" />
      </Toggle>
    );

    expect(flat(hit()).position).toBe("absolute");
    expect(insets()).toEqual({ top: slop, bottom: slop, left: -1, right: -1 });
  });

  it("a press on the extender toggles", async () => {
    const onPressedChange = jest.fn();
    await render(
      <Toggle pressed={false} onPressedChange={onPressedChange} accessibilityLabel="Bold">
        <ToggleIcon name="bold" />
      </Toggle>
    );

    await fireEvent.press(hit());

    expect(onPressedChange).toHaveBeenCalledTimes(1);
  });

  it("a disabled toggle ignores presses on the extender", async () => {
    const onPressedChange = jest.fn();
    await render(
      <Toggle pressed={false} onPressedChange={onPressedChange} disabled accessibilityLabel="Bold">
        <ToggleIcon name="bold" />
      </Toggle>
    );

    await fireEvent.press(hit());

    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("the extender is hidden from assistive tech, never focusable, and the drawn box keeps its height", async () => {
    await render(
      <Toggle size="sm" pressed={false} onPressedChange={() => {}} accessibilityLabel="Bold">
        <ToggleIcon name="bold" />
      </Toggle>
    );

    const el = hit();
    expect(el.props["aria-hidden"]).toBe(true);
    expect(el.props.focusable).toBe(false);
    const buttons = screen.getAllByRole("switch");
    expect(buttons).toHaveLength(1);
    expect(flat(buttons[0]).height).toBe(32);
  });
});
