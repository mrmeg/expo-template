/**
 * IconButton: an icon-only `Button` whose `accessibilityLabel` is required by
 * type and dev-warned at runtime, with a 44pt hit area on every platform.
 * iOS is the jest-expo default; Android and web live in their own files.
 */
import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { Button, buttonHeights, type ButtonSize } from "../Button";
import { IconButton } from "../IconButton";
import * as componentsBarrel from "../index";

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

/** The drawn box: the only host under the button that carries Button's `minHeight`. */
const drawnBox = () => {
  const button = screen.getByRole("button");
  const box = [button, ...button.queryAll(() => true)].find((node) => typeof flat(node).minHeight === "number");
  if (!box) throw new Error("IconButton rendered no drawn box");
  return flat(box);
};

describe("IconButton", () => {
  it("is named by its accessibilityLabel and has the button role", async () => {
    await render(<IconButton icon="check" accessibilityLabel="Refresh media" />);

    expect(screen.getByRole("button", { name: "Refresh media" })).toBeTruthy();
  });

  it("hides the inner icon from assistive tech, so the label is the only name", async () => {
    await render(<IconButton icon="check" accessibilityLabel="Refresh media" />);

    const icon = screen.getByTestId("icon-check", { includeHiddenElements: true });
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("draws the icon in the preset's text color, the color Button.Icon takes", async () => {
    const glyphColor = () => screen.getByTestId("icon-user", { includeHiddenElements: true }).props.color;

    const filled = await render(<IconButton icon="user" preset="default" accessibilityLabel="Upload media" />);
    const filledColor = glyphColor();
    await filled.unmount();

    const reference = await render(
      <Button preset="default">
        <Button.Icon name="user" />
      </Button>,
    );
    const referenceColor = glyphColor();
    await reference.unmount();

    await render(<IconButton icon="user" preset="ghost" accessibilityLabel="Upload media" />);

    expect(filledColor).toBe(referenceColor);
    expect(glyphColor()).not.toBe(filledColor);
  });

  it.each<[ButtonSize, number]>([
    ["sm", 8],
    ["md", 6],
    ["lg", 2],
  ])("size %s sets a numeric hitSlop that brings both axes to 44", async (size, slop) => {
    await render(<IconButton icon="x" size={size} accessibilityLabel="Close" />);

    const hitSlop = screen.getByRole("button").props.hitSlop;
    expect(hitSlop).toBe(slop);
    expect(buttonHeights[size] + 2 * hitSlop).toBe(44);
  });

  it("defaults to size md", async () => {
    await render(<IconButton icon="x" accessibilityLabel="Close" />);

    expect(screen.getByRole("button").props.hitSlop).toBe(6);
    expect(drawnBox().width).toBe(32);
  });

  it("lets a caller hitSlop win", async () => {
    await render(<IconButton icon="x" hitSlop={12} accessibilityLabel="Close" />);

    expect(screen.getByRole("button").props.hitSlop).toBe(12);
  });

  it("lets a caller hitSlop of 0 opt out", async () => {
    await render(<IconButton icon="x" hitSlop={0} accessibilityLabel="Close" />);

    expect(screen.getByRole("button").props.hitSlop).toBe(0);
  });

  it("takes its heights from Button", () => {
    expect(buttonHeights).toEqual({ sm: 28, md: 32, lg: 40 });
  });

  it.each<[ButtonSize, number]>([
    ["sm", 28],
    ["md", 32],
    ["lg", 40],
  ])("size %s draws a square as wide as it is tall", async (size, height) => {
    await render(<IconButton icon="x" size={size} accessibilityLabel="Close" />);

    const box = drawnBox();
    expect(box.minHeight).toBe(height);
    expect(box.width).toBe(height);
    expect(box.minWidth).toBe(height);
    expect(box.paddingHorizontal).toBe(0);
    expect(box.paddingVertical).toBe(0);
    expect(box.borderRadius).not.toBe(height / 2);
  });

  it.each<[ButtonSize, number]>([
    ["sm", 14],
    ["md", 16],
    ["lg", 20],
  ])("size %s circle rounds to half the height", async (size, radius) => {
    await render(<IconButton icon="x" size={size} shape="circle" accessibilityLabel="Close" />);

    const box = drawnBox();
    expect(box.width).toBe(radius * 2);
    expect(box.borderRadius).toBe(radius);
  });

  it("scales the glyph with the size", async () => {
    const sizes: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 22 };
    for (const size of ["sm", "md", "lg"] as const) {
      const { unmount } = await render(<IconButton icon="x" size={size} accessibilityLabel="Close" />);
      const icon = screen.getByTestId("icon-x", { includeHiddenElements: true });
      expect(flat(icon)).toEqual(expect.objectContaining({ width: sizes[size], height: sizes[size] }));
      await unmount();
    }
  });

  it("lets a caller style override the square, and merges an array style", async () => {
    await render(
      <IconButton icon="x" accessibilityLabel="Close" style={[{ marginTop: 4 }, { borderRadius: 3 }]} />,
    );

    const box = drawnBox();
    expect(box.marginTop).toBe(4);
    expect(box.borderRadius).toBe(3);
    expect(box.width).toBe(32);
  });

  it("fires onPress", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="x" accessibilityLabel="Close" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks presses and announces disabled when disabled", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="x" accessibilityLabel="Close" onPress={onPress} disabled />);

    const button = screen.getByRole("button", { name: "Close" });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("is exported from the components barrel", () => {
    expect(componentsBarrel.IconButton).toBe(IconButton);
  });

  describe("dev warning", () => {
    it("warns once per instance when the label is empty", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const { rerender } = await render(<IconButton icon="x" accessibilityLabel="" />);
      await rerender(<IconButton icon="x" accessibilityLabel="  " />);
      await rerender(<IconButton icon="x" accessibilityLabel="" size="lg" />);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toBe(
        "IconButton: `accessibilityLabel` is required; an icon-only button has no other accessible name.",
      );
    });

    it("warns for each new empty instance", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await render(
        <>
          <IconButton icon="x" accessibilityLabel="" />
          <IconButton icon="x" accessibilityLabel="   " />
        </>,
      );

      expect(warn).toHaveBeenCalledTimes(2);
    });

    it("does not warn when the label is set", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await render(<IconButton icon="x" accessibilityLabel="Close" />);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe("IconButton types", () => {
  it("requires accessibilityLabel", () => {
    // Compile-time only: `bun run pkg ui typecheck` fails when the prop turns optional.
    const unlabelled = (
      // @ts-expect-error accessibilityLabel is required
      <IconButton icon="x" />
    );
    expect(unlabelled).toBeTruthy();
  });
});
