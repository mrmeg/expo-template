/**
 * Switch animations on web. `./forceWebPlatform` must be the first import so
 * `lib/animations` evaluates `shouldUseNativeDriver` for web: RN's Animated has
 * no native driver there and logs a warning per animation when asked for one.
 */
import "./forceWebPlatform";
import "@/test/mockTheme";

import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";

jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
}));

jest.mock("@rn-primitives/switch", () => {
  const ReactActual = require("react");
  const { Pressable, View } = require("react-native");
  return {
    Root: ({ checked, onCheckedChange, disabled, children, style, ...props }: any) =>
      ReactActual.createElement(
        Pressable,
        { accessibilityRole: "switch", onPress: () => !disabled && onCheckedChange?.(!checked), disabled, style, ...props },
        children,
      ),
    Thumb: ({ style, ...props }: any) => ReactActual.createElement(View, { style, ...props }),
  };
});

import { Switch } from "../Switch";

describe("Switch on web", () => {
  it("animates with the JS driver (no useNativeDriver warning)", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await render(<Switch checked onCheckedChange={() => {}} accessibilityLabel="Notifications" />);

    expect(timing).toHaveBeenCalled();
    for (const call of timing.mock.calls) {
      expect((call[1] as { useNativeDriver?: boolean }).useNativeDriver).toBe(false);
    }
    timing.mockRestore();
  });
});
