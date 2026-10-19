/**
 * IconButton on Android: the same accessible name, native `hitSlop` and press
 * as iOS. `Platform.OS` is read at render time, so the flip below works per
 * test (same pattern as StyledText.android.test.tsx).
 */
import "@/test/mockTheme";

import React from "react";
import { Platform } from "react-native";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { IconButton } from "../IconButton";

describe("IconButton (Android)", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(async () => {
    await cleanup();
    Platform.OS = originalOS;
  });

  it("is named by its accessibilityLabel", async () => {
    await render(<IconButton icon="check" accessibilityLabel="Refresh media" />);

    expect(screen.getByRole("button", { name: "Refresh media" })).toBeTruthy();
  });

  it.each([
    ["sm", 8],
    ["md", 6],
    ["lg", 2],
  ] as const)("size %s sets the numeric hitSlop on the Pressable", async (size, slop) => {
    await render(<IconButton icon="x" size={size} accessibilityLabel="Close" />);

    expect(screen.getByRole("button").props.hitSlop).toBe(slop);
  });

  it("fires onPress", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="x" accessibilityLabel="Close" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
