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
