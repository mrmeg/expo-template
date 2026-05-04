/**
 * Button component tests
 *
 * Example test file demonstrating testing patterns for this project:
 * - Using @testing-library/react-native
 * - Mocking theme hooks
 * - Testing accessibility
 * - Testing interactions
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";
import { Button } from "../Button";
import { StyledText } from "../StyledText";

const mockScalePressIn = jest.fn();
const mockScalePressOut = jest.fn();

// Mock useTheme hook with new semantic colors
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: "#F8FAFC",
        cardForeground: "#0F172A",
        popover: "#FFFFFF",
        popoverForeground: "#0F172A",
        primary: "#18181B",
        primaryForeground: "#FAFAFA",
        secondary: "#F4F4F5",
        secondaryForeground: "#18181B",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        destructive: "#EF4444",
        destructiveForeground: "#FFFFFF",
        success: "#22C55E",
        warning: "#F59E0B",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#A1A1AA",
        overlay: "rgba(0, 0, 0, 0.5)",
      },
    },
    scheme: "light",
    getContrastingColor: (bg: string, light: string, dark: string) => {
      // Simple contrast check for testing
      return bg === "#FFFFFF" || bg === "transparent" ? dark : light;
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
  }),
}));

function findFlattenedStyleByBackground(nodes: ReactTestInstance[], backgroundColor: string) {
  return nodes
    .map((node) => StyleSheet.flatten(node.props.style) as Record<string, unknown> | undefined)
    .find((style) => style?.backgroundColor === backgroundColor);
}

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

describe("Button", () => {
  beforeEach(() => {
    mockScalePressIn.mockClear();
    mockScalePressOut.mockClear();
  });

  describe("Rendering", () => {
    it("renders with children", () => {
      render(
        <Button>
          <Text>Click me</Text>
        </Button>
      );

      expect(screen.getByText("Click me")).toBeTruthy();
    });

    it("renders with text prop", () => {
      render(<Button text="Submit" />);

      expect(screen.getByText("Submit")).toBeTruthy();
    });

    it("renders different presets", () => {
      const presets = ["default", "outline", "ghost", "link", "destructive", "secondary"] as const;

      presets.forEach((preset) => {
        const { unmount } = render(
          <Button preset={preset}>
            <Text>{preset}</Text>
          </Button>
        );
        expect(screen.getByText(preset)).toBeTruthy();
        unmount();
      });
    });

    it("renders the default preset with primary color tokens", () => {
      const { UNSAFE_getAllByType } = render(<Button preset="default" text="Primary action" />);

      const buttonSurface = findFlattenedStyleByBackground(UNSAFE_getAllByType(View), "#18181B");
      const textStyle = StyleSheet.flatten(screen.getByText("Primary action").props.style) as Record<string, unknown>;

      expect(buttonSurface).toEqual(expect.objectContaining({ backgroundColor: "#18181B" }));
      expect(textStyle).toEqual(expect.objectContaining({ color: "#FAFAFA" }));
    });

    it("renders the secondary preset with secondary color tokens", () => {
      const { UNSAFE_getAllByType } = render(<Button preset="secondary" text="Secondary action" />);

      const buttonSurface = findFlattenedStyleByBackground(UNSAFE_getAllByType(View), "#F4F4F5");
      const textStyle = StyleSheet.flatten(screen.getByText("Secondary action").props.style) as Record<string, unknown>;

      expect(buttonSurface).toEqual(expect.objectContaining({ backgroundColor: "#F4F4F5" }));
      expect(textStyle).toEqual(expect.objectContaining({ color: "#18181B" }));
    });

    it("renders different sizes", () => {
      const sizes = [
        ["sm", 28],
        ["md", 32],
        ["lg", 40],
      ] as const;

      sizes.forEach(([size, minHeight]) => {
        const { unmount, UNSAFE_getAllByType } = render(
          <Button size={size}>
            <Text>{size}</Text>
          </Button>
        );
        const buttonSurface = findFlattenedStyleByBackground(UNSAFE_getAllByType(View), "#18181B");

        expect(screen.getByText(size)).toBeTruthy();
        expect(buttonSurface).toEqual(expect.objectContaining({ minHeight }));
        unmount();
      });
    });

    it("applies button size typography to nested StyledText children", () => {
      render(
        <Button size="sm">
          <StyledText>Compact</StyledText>
        </Button>
      );

      const textStyle = StyleSheet.flatten(screen.getByText("Compact").props.style) as Record<string, unknown>;

      expect(textStyle.fontSize).toBe(12);
      expect(textStyle.lineHeight).toBeCloseTo(16.8);
    });

    it("renders loading state", () => {
      render(
        <Button loading>
          <Text>Loading</Text>
        </Button>
      );

      // When loading, children should not be rendered
      expect(screen.queryByText("Loading")).toBeNull();
    });
  });

  describe("Accessibility", () => {
    it("has button accessibility role", () => {
      render(<Button text="Accessible" />);

      expect(screen.getByRole("button")).toBeTruthy();
    });

    it("indicates disabled state for accessibility", () => {
      render(<Button text="Disabled" disabled />);

      const button = screen.getByRole("button");
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({
          disabled: true,
          busy: false,
        })
      );
    });

    it("indicates loading/busy state for accessibility", () => {
      render(<Button text="Loading" loading />);

      const button = screen.getByRole("button");
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({
          busy: true,
        })
      );
    });
  });

  describe("Interactions", () => {
    it("calls onPress when pressed", () => {
      const onPress = jest.fn();

      render(<Button text="Press me" onPress={onPress} />);

      fireEvent.press(screen.getByRole("button"));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onPress when disabled", () => {
      const onPress = jest.fn();

      render(<Button text="Disabled" onPress={onPress} disabled />);

      fireEvent.press(screen.getByRole("button"));

      expect(onPress).not.toHaveBeenCalled();
    });

    it("does not call onPress when loading", () => {
      const onPress = jest.fn();

      render(<Button text="Loading" onPress={onPress} loading />);

      fireEvent.press(screen.getByRole("button"));

      expect(onPress).not.toHaveBeenCalled();
    });

    it("composes focus and blur handlers with internal focus state", () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      const focusEvent = { nativeEvent: { target: 1 } };
      const blurEvent = { nativeEvent: { target: 1 } };

      render(<Button text="Focus me" onFocus={onFocus} onBlur={onBlur} />);

      const button = screen.getByRole("button");
      fireEvent(button, "focus", focusEvent);
      fireEvent(button, "blur", blurEvent);

      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledWith(focusEvent);
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledWith(blurEvent);
    });

    it("composes press-in and press-out handlers with scale animation handlers", () => {
      const onPressIn = jest.fn();
      const onPressOut = jest.fn();
      const pressInEvent = { nativeEvent: { pageX: 10, pageY: 20 } };
      const pressOutEvent = { nativeEvent: { pageX: 15, pageY: 25 } };

      render(
        <Button
          text="Press me"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        />
      );

      const button = screen.getByRole("button");
      fireEvent(button, "pressIn", pressInEvent);
      fireEvent(button, "pressOut", pressOutEvent);

      expect(mockScalePressIn).toHaveBeenCalledTimes(1);
      expect(onPressIn).toHaveBeenCalledTimes(1);
      expect(onPressIn).toHaveBeenCalledWith(pressInEvent);
      expect(mockScalePressOut).toHaveBeenCalledTimes(1);
      expect(onPressOut).toHaveBeenCalledTimes(1);
      expect(onPressOut).toHaveBeenCalledWith(pressOutEvent);
    });

    it("does not call press-in or press-out handlers when disabled", () => {
      const onPressIn = jest.fn();
      const onPressOut = jest.fn();

      render(
        <Button
          text="Disabled"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled
        />
      );

      const button = screen.getByRole("button");
      fireEvent(button, "pressIn");
      fireEvent(button, "pressOut");

      expect(mockScalePressIn).not.toHaveBeenCalled();
      expect(onPressIn).not.toHaveBeenCalled();
      expect(mockScalePressOut).not.toHaveBeenCalled();
      expect(onPressOut).not.toHaveBeenCalled();
    });

    it("does not call press-in or press-out handlers when loading", () => {
      const onPressIn = jest.fn();
      const onPressOut = jest.fn();

      render(
        <Button
          text="Loading"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          loading
        />
      );

      const button = screen.getByRole("button");
      fireEvent(button, "pressIn");
      fireEvent(button, "pressOut");

      expect(mockScalePressIn).not.toHaveBeenCalled();
      expect(onPressIn).not.toHaveBeenCalled();
      expect(mockScalePressOut).not.toHaveBeenCalled();
      expect(onPressOut).not.toHaveBeenCalled();
    });
  });

  describe("Accessories", () => {
    it("renders left accessory", () => {
      const LeftAccessory = () => <Text>Left</Text>;

      render(
        <Button text="With Left" LeftAccessory={LeftAccessory} />
      );

      expect(screen.getByText("Left")).toBeTruthy();
      expect(screen.getByText("With Left")).toBeTruthy();
    });

    it("renders right accessory", () => {
      const RightAccessory = () => <Text>Right</Text>;

      render(
        <Button text="With Right" RightAccessory={RightAccessory} />
      );

      expect(screen.getByText("Right")).toBeTruthy();
      expect(screen.getByText("With Right")).toBeTruthy();
    });

    it("hides accessories when loading", () => {
      const LeftAccessory = () => <Text>Left</Text>;
      const RightAccessory = () => <Text>Right</Text>;

      render(
        <Button
          text="Loading"
          loading
          LeftAccessory={LeftAccessory}
          RightAccessory={RightAccessory}
        />
      );

      expect(screen.queryByText("Left")).toBeNull();
      expect(screen.queryByText("Right")).toBeNull();
    });
  });
});
