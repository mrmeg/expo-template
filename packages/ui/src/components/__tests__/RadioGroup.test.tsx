/**
 * RadioGroup tests — controlled selection switching, plus the "compound
 * outside parent" guard rail. Behaviour-only; no @rn-primitives internals.
 */

import "@/test/mockTheme";

import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

import { RadioGroup } from "../RadioGroup";

function ControlledThree() {
  const [value, setValue] = useState("a");
  return (
    <RadioGroup value={value} onValueChange={setValue}>
      <RadioGroup.Item value="a" label="Alpha" />
      <RadioGroup.Item value="b" label="Bravo" />
      <RadioGroup.Item value="c" label="Charlie" />
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("renders all option labels", async () => {
    await render(<ControlledThree />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
  });

  it("changes the selected value when an option label is pressed", async () => {
    const onValueChange = jest.fn();
    await render(
      <RadioGroup value="a" onValueChange={onValueChange}>
        <RadioGroup.Item value="a" label="Alpha" />
        <RadioGroup.Item value="b" label="Bravo" />
      </RadioGroup>,
    );

    await fireEvent.press(screen.getByText("Bravo"));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("throws when an item is rendered outside the root", async () => {
    // Suppress React's expected error log so the test output stays focused.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(() => render(<RadioGroup.Item value="x" label="Solo" />)).rejects.toThrow();
    errorSpy.mockRestore();
  });
});

describe("RadioGroup.Item as one control with a 24px web target", () => {
  it("exposes one radio role per labelled item, named by its label", async () => {
    await render(
      <RadioGroup value="a" onValueChange={() => {}}>
        <RadioGroup.Item value="a" label="Alpha" />
        <RadioGroup.Item value="b" label="Bravo" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual(["Alpha", "Bravo"]);
  });

  describe("on web", () => {
    const { Platform, StyleSheet } = jest.requireActual("react-native");
    const { spacing } = jest.requireActual("../../constants/spacing");
    const originalOS = Platform.OS;
    beforeAll(() => {
      Platform.OS = "web";
    });
    afterAll(() => {
      Platform.OS = originalOS;
    });

    it("gives each radio a hit box of at least spacing.minTarget without growing the row", async () => {
      await render(
        <RadioGroup value="a" onValueChange={() => {}} size="md">
          <RadioGroup.Item value="a" />
        </RadioGroup>,
      );

      const style = StyleSheet.flatten(screen.getByRole("radio").props.style);
      expect(style.minWidth).toBeGreaterThanOrEqual(spacing.minTarget);
      expect(style.minHeight).toBeGreaterThanOrEqual(spacing.minTarget);
      expect(style.margin).toBe(-(spacing.minTarget - 20) / 2);
    });
  });
});
