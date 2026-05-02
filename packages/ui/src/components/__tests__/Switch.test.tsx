/**
 * Switch component tests
 *
 * Tests rendering, interaction, and disabled state.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Switch } from "../Switch";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        primary: "#18181B",
        primaryForeground: "#FFFFFF",
        text: "#0F172A",
        textDim: "#64748B",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        background: "#FFFFFF",
        foreground: "#0F172A",
      },
    },
    getShadowStyle: () => ({}),
    getContrastingColor: () => "#FFFFFF",
    withAlpha: (color: string, alpha: number) => {
      if (color.startsWith("#") && color.length === 7) {
        const red = Number.parseInt(color.slice(1, 3), 16);
        const green = Number.parseInt(color.slice(3, 5), 16);
        const blue = Number.parseInt(color.slice(5, 7), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      }

      return color;
    },
  }),
}));

// Mock haptics
jest.mock("../../lib/haptics", () => ({
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

  it("adds contrast styling to the track and thumb", () => {
    const tree = render(<Switch checked={false} onCheckedChange={() => {}} />).toJSON();

    expect(tree).toBeTruthy();
    expect(Array.isArray(tree)).toBe(false);

    if (!tree || Array.isArray(tree)) {
      throw new Error("Expected a single switch tree");
    }

    const track = tree.children?.[0] as any;
    const thumbWrapper = tree.children?.[1] as any;
    const thumbInner = thumbWrapper?.children?.[0] as any;

    expect(track?.props.style.backgroundColor).toBe("#E4E4E7");
    expect(track?.props.style.borderWidth).toBe(1);
    expect(track?.props.style.borderColor).toBe("#D4D4D8");

    expect(thumbInner?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "rgba(0, 0, 0, 0.12)",
        }),
      ])
    );
  });
});
