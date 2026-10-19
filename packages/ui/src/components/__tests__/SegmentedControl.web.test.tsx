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

/** The pill only mounts once the track has been measured. */
const layoutTrack = async (width = 302) =>
  fireEvent(screen.getByTestId("segmented-control"), "layout", { nativeEvent: { layout: { width, height: 32 } } });

const selectedStates = () => screen.getAllByRole("button").map((button) => button.props.accessibilityState.selected);

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

  describe("value that is not in values", () => {
    it("shows the pill for a matched value once the track is measured (control)", async () => {
      await render(<SegmentedControl values={["Light", "Dark"]} value="Dark" onValueChange={() => {}} />);
      await layoutTrack();
      expect(screen.getByTestId("segmented-control-pill")).toBeTruthy();
      expect(selectedStates()).toEqual([false, true]);
    });

    it("selects no segment and draws no pill", async () => {
      await render(<SegmentedControl values={["Light", "Dark"]} value="Custom" onValueChange={() => {}} />);
      await layoutTrack();
      expect(selectedStates()).toEqual([false, false]);
      expect(screen.queryByTestId("segmented-control-pill")).toBeNull();
      // No segment is painted as selected either.
      expect(colorOf("Light")).toBe(colors.mutedForeground);
      expect(colorOf("Dark")).toBe(colors.mutedForeground);
    });

    it("selects no segment for an unmatched defaultValue", async () => {
      await render(<SegmentedControl values={["Light", "Dark"]} defaultValue="Custom" />);
      await layoutTrack();
      expect(selectedStates()).toEqual([false, false]);
      expect(screen.queryByTestId("segmented-control-pill")).toBeNull();
    });

    it("still selects the first segment when uncontrolled with no defaultValue", async () => {
      await render(<SegmentedControl values={["Light", "Dark"]} />);
      await layoutTrack();
      expect(selectedStates()).toEqual([true, false]);
    });

    it("selects the pressed segment and brings the pill in", async () => {
      const onValueChange = jest.fn();
      await render(<SegmentedControl values={["Light", "Dark"]} defaultValue="Custom" onValueChange={onValueChange} />);
      await layoutTrack();
      await fireEvent.press(screen.getByText("Dark"));
      expect(onValueChange).toHaveBeenCalledWith("Dark");
      expect(selectedStates()).toEqual([false, true]);
      expect(screen.getByTestId("segmented-control-pill")).toBeTruthy();
    });

    it("selects a segment when a controlled value moves from unmatched to matched", async () => {
      const { rerender } = await render(<SegmentedControl values={["Light", "Dark"]} value="Custom" />);
      await layoutTrack();
      await rerender(<SegmentedControl values={["Light", "Dark"]} value="Light" />);
      expect(selectedStates()).toEqual([true, false]);
      expect(screen.getByTestId("segmented-control-pill")).toBeTruthy();
    });

    it("places the pill on the new segment instead of sliding in from the first", async () => {
      const values = ["Light", "Dark"];
      const { rerender } = await render(<SegmentedControl values={values} value="Custom" />);
      await layoutTrack(302);
      await rerender(<SegmentedControl values={values} value="Dark" />);
      const { transform } = StyleSheet.flatten(screen.getByTestId("segmented-control-pill").props.style);
      // (302 - 2 * 2) / 2 = 149 per segment; the second segment sits one segment over.
      expect(transform).toEqual([{ translateX: 149 }]);
    });
  });

  describe("size", () => {
    const trackHeight = () => StyleSheet.flatten(screen.getByTestId("segmented-control").props.style).height;

    it("is a 32 pt track by default", async () => {
      await render(<SegmentedControl values={["A", "B"]} value="A" />);
      expect(trackHeight()).toBe(32);
    });

    it('is a 32 pt track for size="md"', async () => {
      await render(<SegmentedControl size="md" values={["A", "B"]} value="A" />);
      expect(trackHeight()).toBe(32);
    });

    it('is a 44 pt track for size="lg"', async () => {
      await render(<SegmentedControl size="lg" values={["A", "B"]} value="A" />);
      expect(trackHeight()).toBe(44);
    });
  });
});
