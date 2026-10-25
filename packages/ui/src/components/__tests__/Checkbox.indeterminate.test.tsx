/**
 * Checkbox's indeterminate state against the real `@rn-primitives/checkbox`
 * (the main Checkbox test mocks it): the primitive sets `aria-checked` from
 * `checked` and mounts its indicator only while checked, so an unchecked,
 * indeterminate box read as "not checked" and drew no dash.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Checkbox } from "../Checkbox";

const dash = () => screen.queryByTestId("icon-minus", { includeHiddenElements: true });
const check = () => screen.queryByTestId("icon-check", { includeHiddenElements: true });

describe("Checkbox indeterminate", () => {
  it("reads as mixed and draws the dash while unchecked", async () => {
    await render(<Checkbox checked={false} indeterminate onCheckedChange={() => {}} accessibilityLabel="Select all" />);

    const box = screen.getByRole("checkbox");
    // RN folds `aria-checked` into the host's accessibility state.
    expect(box).toBePartiallyChecked();
    expect(dash()).not.toBeNull();
    expect(check()).toBeNull();
  });

  it("checks when pressed", async () => {
    const onCheckedChange = jest.fn();
    await render(<Checkbox checked={false} indeterminate onCheckedChange={onCheckedChange} accessibilityLabel="Select all" />);

    await fireEvent.press(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reads as checked or unchecked, without a dash, when not indeterminate", async () => {
    const { rerender } = await render(<Checkbox checked onCheckedChange={() => {}} accessibilityLabel="A" />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(check()).not.toBeNull();

    await rerender(<Checkbox checked={false} onCheckedChange={() => {}} accessibilityLabel="A" />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).not.toBePartiallyChecked();
    expect(dash()).toBeNull();
  });
});
