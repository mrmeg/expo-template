/**
 * Android state surfaces — `collapsable={false}` guard.
 *
 * A plain `View` whose `opacity` (or `pointerEvents`) follows component state
 * flips in and out of being a Fabric stacking context, and Android re-parents
 * its children on every flip (`addViewAt: cannot insert view … View already
 * has a parent`, doglog #57). Every such surface in the package spreads
 * `stateSurfaceProps()`, which pins `collapsable={false}` on Android only.
 * `Platform.OS` is read at render time, so the flip below works per test
 * (same pattern as StyledText.android.test.tsx).
 */

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { cleanup, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { Button } from "../Button";
import { InputOTP } from "../InputOTP";
import { Slider } from "../Slider";
import { Switch } from "../Switch";
import { TextInput } from "../TextInput";
import { interaction } from "../../constants/interaction";

jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
  hapticMedium: jest.fn(),
  hapticHeavy: jest.fn(),
}));

// The native slider is a SwiftUI / Compose view; in tests it is a leaf.
jest.mock("@expo/ui/community/slider", () => {
  const React = require("react") as typeof import("react");
  return { Slider: (props: object) => React.createElement("NativeSlider", props) };
});

type Style = Record<string, unknown>;

function hostViews(): TestInstance[] {
  const root = screen.root;
  if (!root) return [];
  return [root, ...root.queryAll(() => true)].filter((node) => node.type === "View");
}

function styleOf(node: TestInstance): Style {
  return (StyleSheet.flatten(node.props.style) as Style | undefined) ?? {};
}

/** Every host View carrying an `opacity` style must be pinned; there must be at least one. */
function expectOpacityViewsPinned(minimum = 1) {
  const surfaces = hostViews().filter((node) => "opacity" in styleOf(node));
  expect(surfaces.length).toBeGreaterThanOrEqual(minimum);
  for (const surface of surfaces) {
    expect(surface.props.collapsable).toBe(false);
  }
  return surfaces;
}

function findView(predicate: (style: Style) => boolean): TestInstance {
  const match = hostViews().find((node) => predicate(styleOf(node)));
  if (!match) throw new Error("no host View matched the resting style");
  return match;
}

describe("Android state surfaces stay collapsable={false}", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(async () => {
    await cleanup();
    Platform.OS = originalOS;
  });

  describe("Button", () => {
    it("pins the surface while disabled", async () => {
      await render(<Button disabled text="Save" onPress={() => {}} />);

      const surfaces = expectOpacityViewsPinned();
      expect(surfaces.some((node) => styleOf(node).opacity === interaction.disabledOpacity)).toBe(true);
    });

    it("pins the surface and the content while loading", async () => {
      await render(<Button loading text="Save" onPress={() => {}} />);

      const surfaces = expectOpacityViewsPinned();
      // Content hides with opacity 0 + pointerEvents none while pending.
      expect(surfaces.some((node) => styleOf(node).opacity === 0 && styleOf(node).pointerEvents === "none")).toBe(true);
      expect(findView((style) => style.minHeight !== undefined).props.collapsable).toBe(false);
    });

    it("keeps the same surfaces pinned at rest, so a flip never changes the tree", async () => {
      await render(<Button text="Save" onPress={() => {}} />);

      expect(findView((style) => style.minHeight !== undefined).props.collapsable).toBe(false);
      expect(findView((style) => style.pointerEvents === "auto").props.collapsable).toBe(false);
    });

    it("adds nothing on iOS", async () => {
      Platform.OS = "ios";
      await render(<Button disabled text="Save" onPress={() => {}} />);

      expect(findView((style) => style.minHeight !== undefined).props.collapsable).toBeUndefined();
    });
  });

  describe("TextInput", () => {
    it("pins the native surface while not editable", async () => {
      await render(<TextInput value="" onChangeText={() => {}} editable={false} />);

      const surfaces = expectOpacityViewsPinned();
      expect(surfaces.some((node) => styleOf(node).opacity === interaction.disabledOpacity && styleOf(node).overflow === "hidden")).toBe(true);
    });

    it("keeps the surface pinned while editable", async () => {
      await render(<TextInput value="" onChangeText={() => {}} />);

      expect(findView((style) => style.overflow === "hidden").props.collapsable).toBe(false);
    });
  });

  describe("Slider", () => {
    it("pins the wrapper while disabled", async () => {
      await render(<Slider value={20} onValueChange={() => {}} disabled />);

      const surfaces = expectOpacityViewsPinned();
      expect(surfaces.some((node) => styleOf(node).opacity === 0.5)).toBe(true);
    });

    it("keeps the wrapper pinned while enabled", async () => {
      await render(<Slider value={20} onValueChange={() => {}} />);

      expect(findView((style) => style.alignSelf === "stretch").props.collapsable).toBe(false);
    });
  });

  describe("InputOTP", () => {
    it("pins every cell while disabled", async () => {
      await render(<InputOTP value="12" onChangeText={() => {}} disabled />);

      const surfaces = expectOpacityViewsPinned(6);
      expect(surfaces.every((node) => styleOf(node).opacity === 0.5)).toBe(true);
    });

    it("keeps the cells pinned while enabled", async () => {
      await render(<InputOTP value="" onChangeText={() => {}} />);

      const cells = hostViews().filter((node) => styleOf(node).borderWidth !== undefined && styleOf(node).width !== undefined);
      expect(cells).toHaveLength(6);
      for (const cell of cells) expect(cell.props.collapsable).toBe(false);
    });
  });

  describe("Switch", () => {
    it("pins both labels whether checked or not", async () => {
      await render(<Switch checked onCheckedChange={() => {}} labelOn="On" labelOff="Off" />);
      // The root Pressable carries `opacity: 1` too (RN pins it itself); the labels are the absolute Views.
      const checked = expectOpacityViewsPinned(3).filter((node) => styleOf(node).position === "absolute");
      expect(checked.map((node) => styleOf(node).opacity).sort()).toEqual([0, 1]);
      await cleanup();

      await render(<Switch checked={false} onCheckedChange={() => {}} labelOn="On" labelOff="Off" />);
      const unchecked = expectOpacityViewsPinned(3).filter((node) => styleOf(node).position === "absolute");
      expect(unchecked.map((node) => styleOf(node).opacity).sort()).toEqual([0, 1]);
    });
  });
});
