/**
 * SegmentedControl on Android: the platform control for the default size, the
 * kit-drawn 44 pt control for `size="lg"`, and no selection for a value that
 * is not in `values`. `Platform.OS` is read at render time, so the flip below
 * works per test (same pattern as StyledText.android.test.tsx).
 */

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { SegmentedControl } from "../SegmentedControl";
import { NativeSegmentedControl } from "../nativeSegmentedControl.android";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        accent: "#14B8A6",
        accentForeground: "#FFFFFF",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        text: "#111111",
        ring: "#0F172A",
      },
    },
    getContrastingColor: () => "#000000",
    getFocusRingStyle: () => ({}),
  }),
}));

// The Android variant's Material buttons, recorded by their props.
jest.mock("@expo/ui/jetpack-compose", () => {
  const { View, Text, Pressable } = require("react-native");
  const Host = ({ children }: any) => <View>{children}</View>;
  const SingleChoiceSegmentedButtonRow = ({ children }: any) => <View>{children}</View>;
  const SegmentedButton = ({ children, selected, onClick, colors }: any) => (
    <Pressable testID="material-segment" accessibilityState={{ selected }} onPress={onClick} {...{ colors }}>
      {children}
    </Pressable>
  );
  SegmentedButton.Label = function Label({ children }: any) {
    return <View>{children}</View>;
  };
  return { Host, SingleChoiceSegmentedButtonRow, SegmentedButton, Text };
});

// Mock the native segmented control as a row of pressable segments. It
// records the label color the control picked for the selected segment.
jest.mock("../nativeSegmentedControl", () => {
  const { View, Text, Pressable } = require("react-native");
  function NativeSegmentedControl({ values, selectedIndex, onValueChange, tintColor, selectedLabelColor }: any) {
    return (
      <View testID="segmented" accessibilityValue={{ now: selectedIndex }} {...{ tintColor, selectedLabelColor }}>
        {values.map((label: string) => (
          <Pressable key={label} testID={`seg-${label}`} onPress={() => onValueChange?.(label)}>
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return { NativeSegmentedControl };
});

describe("SegmentedControl (android)", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(async () => {
    await cleanup();
    Platform.OS = originalOS;
  });

  it("selects no segment (-1) for a controlled value that is not in values", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} value="Custom" onValueChange={() => {}} />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(-1);
  });

  it("still selects the first segment when uncontrolled with no defaultValue", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(0);
  });

  it("renders the platform control for the default size", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" />);
    expect(screen.getByTestId("segmented")).toBeTruthy();
    expect(screen.queryByTestId("segmented-control")).toBeNull();
  });

  describe('size="lg"', () => {
    it("draws a 44 pt kit control instead of the native one", async () => {
      await render(<SegmentedControl size="lg" values={["A", "B"]} value="A" />);
      expect(StyleSheet.flatten(screen.getByTestId("segmented-control").props.style).height).toBe(44);
      expect(screen.queryByTestId("segmented")).toBeNull();
    });

    it("reports a pressed segment by its label", async () => {
      const onValueChange = jest.fn();
      await render(<SegmentedControl size="lg" values={["A", "B"]} value="A" onValueChange={onValueChange} />);
      await fireEvent.press(screen.getByText("B"));
      expect(onValueChange).toHaveBeenCalledWith("B");
    });

    it("selects no segment for a value that is not in values", async () => {
      await render(<SegmentedControl size="lg" values={["A", "B"]} value="missing" />);
      for (const button of screen.getAllByRole("button")) {
        expect(button.props.accessibilityState.selected).toBe(false);
      }
    });
  });

  describe("Material variant", () => {
    const props = {
      values: ["Cameras", "Groups"],
      selectedIndex: 0,
      enabled: true,
      tintColor: "#F5D27A",
      selectedLabelColor: "#14121F",
      appearance: "dark" as const,
    };

    it("colors the selected label as well as the fill, so a light accent stays readable in dark mode", async () => {
      await render(<NativeSegmentedControl {...props} onValueChange={() => {}} />);
      for (const segment of screen.getAllByTestId("material-segment")) {
        expect(segment.props.colors).toEqual({ activeContainerColor: "#F5D27A", activeContentColor: "#14121F" });
      }
    });

    it("reports a pressed segment by its label", async () => {
      const onValueChange = jest.fn();
      await render(<NativeSegmentedControl {...props} onValueChange={onValueChange} />);
      await fireEvent.press(screen.getAllByTestId("material-segment")[1]);
      expect(onValueChange).toHaveBeenCalledWith("Groups");
    });
  });

  it("pairs the theme accent with accentForeground, and a custom tint with its contrasting color", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" />);
    expect(screen.getByTestId("segmented").props).toMatchObject({ tintColor: "#14B8A6", selectedLabelColor: "#FFFFFF" });
    await cleanup();
    await render(<SegmentedControl values={["A", "B"]} value="A" tintColor="#F5D27A" />);
    expect(screen.getByTestId("segmented").props).toMatchObject({ tintColor: "#F5D27A", selectedLabelColor: "#000000" });
  });
});
