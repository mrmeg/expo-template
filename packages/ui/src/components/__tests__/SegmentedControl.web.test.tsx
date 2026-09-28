/**
 * SegmentedControl on web renders the kit's own themed control (the vendored
 * `@expo/ui` web control paints every label white once a tint is passed, so
 * unselected labels vanished on the light track). `./forceWebPlatform` first.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SegmentedControl } from "../SegmentedControl";
import { interaction } from "../../constants/interaction";

const colors = {
  accent: "#14B8A6",
  accentForeground: "#FFFFFF",
  muted: "#F1F5F9",
  mutedForeground: "#64748B",
  text: "#111111",
  background: "#FFFFFF",
  ring: "#0F172A",
};

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { dark: false, colors },
    getFocusRingStyle: () => ({ boxShadow: "ring" }),
    getShadowStyle: () => ({}),
  }),
}));

jest.mock("@expo/ui/community/segmented-control", () => ({
  SegmentedControl: () => {
    throw new Error("the vendored web control must not render");
  },
}));

const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;

describe("SegmentedControl (web)", () => {
  it("colors the selected label with accentForeground and the rest with mutedForeground", async () => {
    await render(<SegmentedControl values={["Day", "Week", "Month"]} value="Week" onValueChange={() => {}} />);
    expect(colorOf("Week")).toBe(colors.accentForeground);
    expect(colorOf("Day")).toBe(colors.mutedForeground);
    expect(colorOf("Month")).toBe(colors.mutedForeground);
  });

  it("exposes each segment as a selectable button and reports taps by value", async () => {
    const onValueChange = jest.fn();
    await render(<SegmentedControl values={["Day", "Week"]} value="Day" onValueChange={onValueChange} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    await fireEvent.press(buttons[1]);
    expect(onValueChange).toHaveBeenCalledWith("Week");
  });

  it("dims the whole control to the disabled token and ignores taps", async () => {
    const onValueChange = jest.fn();
    await render(<SegmentedControl values={["On", "Off"]} value="On" onValueChange={onValueChange} disabled />);
    const control = screen.getByTestId("segmented-control");
    expect(StyleSheet.flatten(control.props.style).opacity).toBe(interaction.disabledOpacity);
    await fireEvent.press(screen.getByText("Off"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("drives uncontrolled selection from defaultValue", async () => {
    await render(<SegmentedControl values={["A", "B"]} defaultValue="B" />);
    expect(colorOf("B")).toBe(colors.accentForeground);
    await fireEvent.press(screen.getByText("A"));
    expect(colorOf("A")).toBe(colors.accentForeground);
    expect(colorOf("B")).toBe(colors.mutedForeground);
  });
});
