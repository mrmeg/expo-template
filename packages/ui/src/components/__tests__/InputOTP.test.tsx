/**
 * InputOTP component tests
 *
 * Tests cell rendering, autoFocus behavior, and accessibility.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { InputOTP } from "../InputOTP";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: "#0F172A",
        primary: "#18181B",
        border: "#E2E8F0",
        destructive: "#EF4444",
        muted: "#F1F5F9",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

// Mock haptics
jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
  hapticHeavy: jest.fn(),
}));

describe("InputOTP", () => {
  it("renders correct number of cells for default length (6)", () => {
    render(<InputOTP value="" onChangeText={() => {}} />);

    // 6 cells should each have a "Digit X of 6" accessibility label
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(6);
  });

  it("renders correct number of cells for custom length", () => {
    render(<InputOTP value="" onChangeText={() => {}} length={4} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);
  });

  it("does not auto-focus by default", () => {
    render(<InputOTP value="" onChangeText={() => {}} />);

    // The hidden TextInput should not have autoFocus
    // With autoFocus=false (new default), the input won't grab focus on mount
    const label = screen.getByLabelText("Verification code input");
    expect(label.props.autoFocus).toBe(false);
  });

  it("auto-focuses when explicitly enabled", () => {
    render(<InputOTP value="" onChangeText={() => {}} autoFocus />);

    const label = screen.getByLabelText("Verification code input");
    expect(label.props.autoFocus).toBe(true);
  });

  it("renders cells with position accessibility labels", () => {
    render(<InputOTP value="" onChangeText={() => {}} length={4} />);

    expect(screen.getByLabelText("Digit 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Digit 2 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Digit 3 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Digit 4 of 4")).toBeTruthy();
  });

  it("displays entered characters", () => {
    render(<InputOTP value="12" onChangeText={() => {}} length={4} />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders error state", () => {
    render(<InputOTP value="" onChangeText={() => {}} error errorText="Invalid code" />);

    expect(screen.getByText("Invalid code")).toBeTruthy();
  });

  it("calls onComplete when all cells are filled", () => {
    const onComplete = jest.fn();

    render(
      <InputOTP value="" onChangeText={() => {}} onComplete={onComplete} length={6} />
    );

    // Simulate typing the full code via the hidden input
    const input = screen.getByLabelText("Verification code input");
    fireEvent.changeText(input, "123456");

    expect(onComplete).toHaveBeenCalledWith("123456");
  });
});
