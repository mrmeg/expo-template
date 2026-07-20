/**
 * Checkbox component tests
 *
 * Tests rendering, interaction, and accessibility.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Checkbox } from "../Checkbox";
import { spacing } from "../../constants/spacing";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#18181B",
        primaryForeground: "#FFFFFF",
        border: "#E2E8F0",
        destructive: "#EF4444",
        text: "#0F172A",
        textDim: "#64748B",
        background: "#FFFFFF",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
    getContrastingColor: (_bg: string, fg: string) => fg,
  }),
}));

// Mock haptics
jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
}));

const mockScalePressIn = jest.fn();
const mockScalePressOut = jest.fn();

jest.mock("../../hooks/useScalePress", () => ({
  useScalePress: () => ({
    animatedStyle: {},
    pressHandlers: {
      onPressIn: mockScalePressIn,
      onPressOut: mockScalePressOut,
    },
    scale: { value: 1 },
  }),
}));

// Mock @rn-primitives/checkbox
jest.mock("@rn-primitives/checkbox", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");

  return {
    Root: ({ checked, onCheckedChange, disabled, children, style, ...props }: any) => (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!checked, disabled: !!disabled }}
        onPress={() => !disabled && onCheckedChange?.(!checked)}
        disabled={disabled}
        style={style}
        {...props}
      >
        {typeof children === "function" ? children({ checked: !!checked }) : children}
      </Pressable>
    ),
    Indicator: ({ children, style, ...props }: any) => (
      <View style={style} {...props}>{children}</View>
    ),
  };
});

describe("Checkbox", () => {
  beforeEach(() => {
    mockScalePressIn.mockClear();
    mockScalePressOut.mockClear();
  });

  it("wires press-in and press-out to the scale-press handlers", async () => {
    await render(<Checkbox checked={false} onCheckedChange={() => {}} />);

    const checkbox = screen.getByRole("checkbox");
    await fireEvent(checkbox, "pressIn");
    await fireEvent(checkbox, "pressOut");

    expect(mockScalePressIn).toHaveBeenCalledTimes(1);
    expect(mockScalePressOut).toHaveBeenCalledTimes(1);
  });

  it("renders in unchecked state", async () => {
    await render(<Checkbox checked={false} onCheckedChange={() => {}} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeTruthy();
    expect(checkbox.props.accessibilityState.checked).toBe(false);
  });

  it("renders in checked state", async () => {
    await render(<Checkbox checked={true} onCheckedChange={() => {}} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.props.accessibilityState.checked).toBe(true);
  });

  it("updates when checked is changed by a parent", async () => {
    const { rerender } = await render(
      <Checkbox checked={false} onCheckedChange={() => {}} />
    );

    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false);

    await rerender(<Checkbox checked={true} onCheckedChange={() => {}} />);

    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true);
  });

  it("calls onCheckedChange when pressed", async () => {
    const onCheckedChange = jest.fn();

    await render(<Checkbox checked={false} onCheckedChange={onCheckedChange} />);

    await fireEvent.press(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", async () => {
    const onCheckedChange = jest.fn();

    await render(<Checkbox checked={false} onCheckedChange={onCheckedChange} disabled />);

    await fireEvent.press(screen.getByRole("checkbox"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("renders label text when provided", async () => {
    await render(<Checkbox checked={false} onCheckedChange={() => {}} label="Accept terms" />);

    expect(screen.getByText("Accept terms")).toBeTruthy();
  });

  it("indicates disabled state for accessibility", async () => {
    await render(<Checkbox checked={false} onCheckedChange={() => {}} disabled />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.props.accessibilityState.disabled).toBe(true);
  });

  it("uses radiusXs for the box (steps down from radiusSm post radius-rebase to avoid an over-rounded control)", async () => {
    await render(<Checkbox checked={false} onCheckedChange={() => {}} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.props.style.borderRadius).toBe(spacing.radiusXs);
  });
});
