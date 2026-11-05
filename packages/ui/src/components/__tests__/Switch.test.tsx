/**
 * Switch component tests
 *
 * Tests rendering, interaction, and disabled state.
 */

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Switch } from "../Switch";
import { useThemeStore } from "../../state/themeStore";

let mockDark = false;

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: mockDark,
      colors: {
        primary: "#18181B",
        primaryForeground: "#FAFAFA",
        accent: "#14B8A6",
        accentForeground: "#FFFFFF",
        text: "#0F172A",
        textDim: "#64748B",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        input: "#E4E4E7",
        ring: "#A1A1AA",
        background: "#FFFFFF",
        foreground: "#0F172A",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
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
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
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
  it("renders in unchecked state", async () => {
    await render(<Switch checked={false} onCheckedChange={() => {}} />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeTruthy();
    expect(switchEl.props.accessibilityState.checked).toBe(false);
  });

  it("renders in checked state", async () => {
    await render(<Switch checked={true} onCheckedChange={() => {}} />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl.props.accessibilityState.checked).toBe(true);
  });

  it("calls onCheckedChange when pressed", async () => {
    const onCheckedChange = jest.fn();

    await render(<Switch checked={false} onCheckedChange={onCheckedChange} />);

    await fireEvent.press(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", async () => {
    const onCheckedChange = jest.fn();

    await render(<Switch checked={false} onCheckedChange={onCheckedChange} disabled />);

    await fireEvent.press(screen.getByRole("switch"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("indicates disabled state for accessibility", async () => {
    await render(<Switch checked={false} onCheckedChange={() => {}} disabled />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl.props.accessibilityState.disabled).toBe(true);
  });

  it("adds contrast styling to the track and thumb", async () => {
    const tree = (await render(<Switch checked={false} onCheckedChange={() => {}} />)).toJSON();

    expect(tree).toBeTruthy();
    expect(Array.isArray(tree)).toBe(false);

    if (!tree || Array.isArray(tree)) {
      throw new Error("Expected a single switch tree");
    }

    // The root node is now the press-scale Animated.View wrapper; the switch
    // Pressable (and its track/thumb children) is one level in.
    const switchRoot = tree.children?.[0] as any;
    const track = switchRoot?.children?.[0] as any;
    const thumbWrapper = switchRoot?.children?.[1] as any;
    const thumbInner = thumbWrapper?.children?.[0] as any;
    const thumbStyle = StyleSheet.flatten(thumbInner?.props.style);

    expect(track?.props.style.backgroundColor).toBe("#E4E4E7");
    expect(track?.props.style.borderWidth).toBe(1);
    expect(track?.props.style.borderColor).toBe("#D4D4D8");

    expect(thumbStyle).toEqual(
      expect.objectContaining({
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.1)",
      }),
    );
  });

  const checkedParts = async (props: Partial<React.ComponentProps<typeof Switch>> = {}) => {
    const tree = (await render(<Switch checked={true} onCheckedChange={() => {}} {...props} />)).toJSON();
    if (!tree || Array.isArray(tree)) {
      throw new Error("Expected a single switch tree");
    }
    const switchRoot = tree.children?.[0] as any;
    const track = switchRoot?.children?.[0] as any;
    const thumbInner = switchRoot?.children?.[1]?.children?.[0] as any;
    return {
      track: StyleSheet.flatten(track?.props.style),
      thumb: StyleSheet.flatten(thumbInner?.props.style),
    };
  };

  describe("switchTrack treatment", () => {
    afterEach(() => {
      useThemeStore.getState().setTreatments({});
    });

    it('"primary" (default) fills the checked track with primary and keeps a white thumb in light', async () => {
      const { track, thumb } = await checkedParts();

      expect(track.backgroundColor).toBe("#18181B");
      expect(track.borderColor).toBe("rgba(24, 24, 27, 0.42)");
      expect(thumb.backgroundColor).toBe("#FFFFFF");
    });

    it('"primary" also applies to the ios variant instead of the system green', async () => {
      const { track } = await checkedParts({ variant: "ios" });

      expect(track.backgroundColor).toBe("#18181B");
    });

    it('"primary" uses the primaryForeground thumb in dark, where primary is a light grey', async () => {
      mockDark = true;
      try {
        const { track, thumb } = await checkedParts();

        expect(track.backgroundColor).toBe("#18181B");
        expect(thumb.backgroundColor).toBe("#FAFAFA");
      } finally {
        mockDark = false;
      }
    });

    it('"accent" uses the accent token, and the ios variant keeps the system green', async () => {
      useThemeStore.getState().setTreatments({ switchTrack: "accent" });
      const accent = await checkedParts();

      expect(accent.track.backgroundColor).toBe("#14B8A6");
      expect(accent.track.borderColor).toBe("rgba(20, 184, 166, 0.42)");

      const ios = await checkedParts({ variant: "ios" });
      expect(ios.track.backgroundColor).toBe("#34C759");
    });
  });

  it("keeps custom switch thumb inset equal to vertical clearance", async () => {
    const tree = (await render(
      <Switch
        checked={false}
        onCheckedChange={() => {}}
        size={{ width: 60, height: 32 }}
        thumbSize={20}
        labelOn="ON"
        labelOff="OFF"
      />
    )).toJSON();

    expect(tree).toBeTruthy();
    expect(Array.isArray(tree)).toBe(false);

    if (!tree || Array.isArray(tree)) {
      throw new Error("Expected a single switch tree");
    }

    const switchRoot = tree.children?.[0] as any;
    const labelOn = switchRoot?.children?.[1] as any;
    const thumbWrapper = switchRoot?.children?.[2] as any;
    const thumbInner = thumbWrapper?.children?.[0] as any;
    const labelOff = switchRoot?.children?.[3] as any;
    const thumbStyle = StyleSheet.flatten(thumbInner?.props.style);

    expect(thumbStyle).toEqual(
      expect.objectContaining({
        marginLeft: 6,
      }),
    );
    expect(thumbStyle?.transform).toEqual([{ translateX: 0 }]);

    expect(labelOn?.props.style).toEqual(
      expect.objectContaining({
        left: 4,
        right: 30,
      }),
    );
    expect(labelOff?.props.style).toEqual(
      expect.objectContaining({
        left: 30,
        right: 4,
      }),
    );
  });
});
