/**
 * On web, Button reaches a 44pt pointer target through a transparent hit
 * extender inside the drawn box (react-native-web ignores `hitSlop`); the
 * drawn 28/32/40pt box and the Pressable root do not change.
 * `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { Button, type ButtonSize } from "../Button";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: "#F8FAFC",
        primary: "#18181B",
        primaryForeground: "#FAFAFA",
        secondary: "#F4F4F5",
        secondaryForeground: "#18181B",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        destructive: "#EF4444",
        destructiveForeground: "#FFFFFF",
        border: "#E2E8F0",
        ring: "#A1A1AA",
      },
    },
    scheme: "light",
    getContrastingColor: (_bg: string, _light: string, dark: string) => dark,
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
  }),
}));

const HIT = "button-hit-target";
const flat = (el: TestInstance) => StyleSheet.flatten(el.props.style) as Record<string, unknown>;
const hit = () => screen.getByTestId(HIT, { includeHiddenElements: true });
const insets = () => {
  const s = flat(hit());
  return { top: s.top, bottom: s.bottom, left: s.left, right: s.right };
};
const hostNodes = (): TestInstance[] => (screen.root ? [screen.root, ...screen.root.queryAll(() => true)] : []);

describe("Button pointer target (web)", () => {
  it.each<[ButtonSize, number]>([
    ["sm", -8],
    ["md", -6],
    ["lg", -2],
  ])("size %s extends the target to 44pt vertically and not horizontally", async (size, slop) => {
    await render(<Button size={size} text="Go" onPress={() => {}} />);

    expect(flat(hit()).position).toBe("absolute");
    expect(insets()).toEqual({ top: slop, bottom: slop, left: 0, right: 0 });
  });

  it("a caller hitSlop object replaces the default, missing sides are 0", async () => {
    await render(<Button hitSlop={{ top: 10, left: 4 }} text="Go" />);

    expect(insets()).toEqual({ top: -10, bottom: 0, left: -4, right: 0 });
  });

  it("a numeric hitSlop applies to all four sides", async () => {
    await render(<Button hitSlop={5} text="Go" />);

    expect(insets()).toEqual({ top: -5, bottom: -5, left: -5, right: -5 });
  });

  it("hitSlop={0} renders no extender", async () => {
    await render(<Button hitSlop={0} text="Go" />);

    expect(screen.queryByTestId(HIT, { includeHiddenElements: true })).toBeNull();
  });

  it("a press on the extender presses the button", async () => {
    const onPress = jest.fn();
    await render(<Button text="Go" onPress={onPress} />);

    await fireEvent.press(hit());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("a disabled button ignores presses on the extender", async () => {
    const onPress = jest.fn();
    await render(<Button text="Go" onPress={onPress} disabled />);

    await fireEvent.press(hit());

    expect(onPress).not.toHaveBeenCalled();
  });

  it("the extender is hidden from assistive tech and never focusable", async () => {
    await render(<Button text="Go" />);

    const el = hit();
    expect(el.props["aria-hidden"]).toBe(true);
    expect(el.props.focusable).toBe(false);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("the drawn box keeps its minHeight, so nothing visible changes", async () => {
    await render(<Button text="Go" />);

    const box = hostNodes().find((node) => flat(node)?.minHeight === 32);
    expect(box).toBeDefined();
    // The extender lives inside the drawn box, so it is positioned against it.
    expect(box!.queryAll((node) => node.props.testID === HIT).length).toBeGreaterThan(0);
    expect(flat(box!).position).toBe("relative");
  });
});
