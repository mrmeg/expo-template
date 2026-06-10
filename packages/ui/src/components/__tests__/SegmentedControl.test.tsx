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

import { render, screen, fireEvent } from "@testing-library/react-native";
import { SegmentedControl } from "../SegmentedControl";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { dark: false, colors: { accent: "#14B8A6" } },
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

  it("defaults selectedIndex to 0 for an unknown value", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="missing" onValueChange={() => {}} />);
    expect(screen.getByTestId("segmented").props.accessibilityValue.now).toBe(0);
  });

  it("disables the native control when disabled", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" disabled />);
    expect(screen.getByTestId("segmented").props.accessibilityState.disabled).toBe(true);
  });

  it("uses the theme accent as the default tint", async () => {
    await render(<SegmentedControl values={["A", "B"]} value="A" />);
    expect(screen.getByTestId("segmented").props.accessibilityLabel).toBe("#14B8A6");
  });
});
