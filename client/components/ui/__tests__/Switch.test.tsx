/**
 * Switch component tests
 *
 * Tests rendering, interaction, and disabled state.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Switch } from "../Switch";

// Mock useTheme hook
jest.mock("@/client/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#18181B",
        primaryForeground: "#FFFFFF",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        background: "#FFFFFF",
        foreground: "#0F172A",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

// Mock haptics
jest.mock("@/client/lib/haptics", () => ({
  hapticLight: jest.fn(),
}));

// Mock @rn-primitives/switch
jest.mock("@rn-primitives/switch", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");

  return {
    Root: ({ checked, onCheckedChange, disabled, children, style, ...props }: any) => (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: !!checked, disabled: !!disabled }}
        onPress={() => !disabled && onCheckedChange?.(!checked)}
        disabled={disabled}
        style={style}
        {...props}
      >
        {typeof children === "function" ? children({ checked: !!checked }) : children}
      </Pressable>
    ),
    Thumb: ({ children, style, ...props }: any) => (
      <View style={style} {...props}>{children}</View>
    ),
  };
});

describe("Switch", () => {
  it("renders in unchecked state", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeTruthy();
    expect(switchEl.props.accessibilityState.checked).toBe(false);
  });

  it("renders in checked state", () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl.props.accessibilityState.checked).toBe(true);
  });

  it("calls onCheckedChange when pressed", () => {
    const onCheckedChange = jest.fn();

    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.press(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", () => {
    const onCheckedChange = jest.fn();

    render(<Switch checked={false} onCheckedChange={onCheckedChange} disabled />);

    fireEvent.press(screen.getByRole("switch"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("indicates disabled state for accessibility", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} disabled />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl.props.accessibilityState.disabled).toBe(true);
  });
});
