/**
 * SegmentedControl component tests
 *
 * SegmentedControl is a value-based wrapper over the native
 * `@expo/ui/community/segmented-control`. These tests mock the native control as
 * an inspectable view to verify:
 *   - value → selectedIndex mapping,
 *   - onValueChange round-trips the selected string,
 *   - disabled flips `enabled` off,
 *   - the theme accent is the default tint.
 */

import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SegmentedControl } from "../SegmentedControl";

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
    getContrastingColor: () => "#FFFFFF",
    getFocusRingStyle: () => ({}),
  }),
}));

// Mock the native segmented control as a row of pressable segments.
jest.mock("@expo/ui/community/segmented-control", () => {
  const { View, Text, Pressable } = require("react-native");
  function SegmentedControl({ values, selectedIndex, enabled, onValueChange, tintColor }: any) {
    return (
      <View
        testID="segmented"
        accessibilityState={{ disabled: enabled === false }}
        // expose props for assertions
        accessibilityValue={{ now: selectedIndex }}
        accessibilityLabel={tintColor}
      >
        {values.map((label: string) => (
          <Pressable key={label} testID={`seg-${label}`} onPress={() => onValueChange?.(label)}>
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return { SegmentedControl };
});

/**
 * Each drawn segment's tap target height: a segment stretches across the
 * segment row, which is positioned inside the track.
 */
const segmentHeights = () => {
  const track = StyleSheet.flatten(screen.getByTestId("segmented-control").props.style).height as number;
  const row = StyleSheet.flatten(screen.getByTestId("segmented-control-segments").props.style);
  return screen.getAllByRole("button").map((button) => {
    const style = StyleSheet.flatten(button.props.style);
    return style.height ?? track - (row.top as number) - (row.bottom as number) - ((style.marginVertical as number) ?? 0);
  });
};

describe("SegmentedControl", () => {
  it("maps the controlled value to selectedIndex", async () => {
    await render(
      <SegmentedControl values={["Day", "Week", "Month"]} value="Month" onValueChange={() => {}} />
    );
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(2);
  });

  it("emits the selected value string on change", async () => {
    const onValueChange = jest.fn();
    await render(
      <SegmentedControl values={["Day", "Week", "Month"]} value="Day" onValueChange={onValueChange} />
    );
    await fireEvent.press(screen.getByTestId("seg-Week"));
    expect(onValueChange).toHaveBeenCalledWith("Week");
  });

  it("selects no segment (-1) for a controlled value that is not in values", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} value="Custom" onValueChange={() => {}} />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(-1);
  });

  it("selects no segment (-1) for a defaultValue that is not in values", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} defaultValue="Custom" />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(-1);
  });

  it("still selects the first segment when uncontrolled with no defaultValue", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(0);
  });

  it("selects the pressed segment after an unmatched defaultValue", async () => {
    await render(<SegmentedControl values={["Light", "Dark"]} defaultValue="Custom" />);
    await fireEvent.press(screen.getByTestId("seg-Dark"));
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(1);
  });

  it("disables the native control when disabled", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" disabled />);
    expect(screen.getByTestId("segmented").props.accessibilityState.disabled).toBe(true);
  });

  it("uses the theme accent as the default tint", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" />);
    expect(screen.getByTestId("segmented").props.accessibilityLabel).toBe("#14B8A6");
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

    it("gives each segment the full 44 pt track height as its tap target", async () => {
      await render(<SegmentedControl size="lg" values={["A", "B"]} value="A" />);
      expect(segmentHeights()).toEqual([44, 44]);
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
});
