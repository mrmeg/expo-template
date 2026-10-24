/**
 * Tests for the iOS native text field wrapper.
 *
 * jest-expo's default platform is iOS, so the suite-wide mocks apply: `@expo/ui`'s
 * `TextInput` renders as an RN TextInput that forwards `modifiers`, and
 * `@expo/ui/swift-ui/modifiers` records `accessibilityLabel` / `accessibilityHint`
 * as `{ name, value }`. The wrapper is loaded through its explicit filename.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { TextInputRef } from "@expo/ui";
import { NativeTextField } from "../nativeTextField.ios";

const labelModifier = (value: string) => ({ name: "accessibilityLabel", value });
const hintModifier = (value: string) => ({ name: "accessibilityHint", value });

describe("NativeTextField (iOS) accessibility", () => {
  it("adds SwiftUI accessibilityLabel and accessibilityHint modifiers", async () => {
    await render(<NativeTextField placeholder="Email" accessibilityLabel="Email" accessibilityHint="Email is required" />);

    expect(screen.getByPlaceholderText("Email").props.modifiers).toEqual([
      labelModifier("Email"),
      hintModifier("Email is required"),
    ]);
  });

  it("adds only the modifier whose prop is set", async () => {
    await render(<NativeTextField placeholder="Email" accessibilityLabel="Email" />);
    expect(screen.getByPlaceholderText("Email").props.modifiers).toEqual([labelModifier("Email")]);

    await screen.rerender(<NativeTextField placeholder="Email" accessibilityHint="Email is required" />);
    expect(screen.getByPlaceholderText("Email").props.modifiers).toEqual([hintModifier("Email is required")]);
  });

  it("adds no accessibility modifier for missing or empty props", async () => {
    await render(<NativeTextField placeholder="Email" accessibilityLabel="" />);

    expect(screen.getByPlaceholderText("Email").props.modifiers).toEqual([]);
  });

  it("keeps the caller's modifiers first", async () => {
    const user = { $type: "user" };
    await render(
      <NativeTextField placeholder="Email" modifiers={[user]} accessibilityLabel="Email" accessibilityHint="Required" />
    );

    expect(screen.getByPlaceholderText("Email").props.modifiers).toEqual([
      user,
      labelModifier("Email"),
      hintModifier("Required"),
    ]);
  });

  it("does not pass the accessibility props on to the universal field", async () => {
    await render(<NativeTextField placeholder="Email" accessibilityLabel="Email" accessibilityHint="Required" />);

    const field = screen.getByPlaceholderText("Email");
    expect(field.props.accessibilityLabel).toBeUndefined();
    expect(field.props.accessibilityHint).toBeUndefined();
  });

  it("forwards the rest of the props and the ref", async () => {
    const ref = React.createRef<TextInputRef>();
    await render(<NativeTextField ref={ref} placeholder="Email" secureTextEntry testID="email-field" />);

    expect(screen.getByTestId("email-field").props.secureTextEntry).toBe(true);
    expect(typeof ref.current?.focus).toBe("function");
  });
});
