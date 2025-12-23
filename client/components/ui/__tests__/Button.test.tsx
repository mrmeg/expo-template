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
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "../Button";

// Mock useTheme hook with new semantic colors
jest.mock("@/client/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: "#F8FAFC",
        cardForeground: "#0F172A",
        primary: "#14B8A6",
        primaryForeground: "#FFFFFF",
        secondary: "#6366F1",
        secondaryForeground: "#FFFFFF",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        destructive: "#EF4444",
        destructiveForeground: "#FFFFFF",
        success: "#22C55E",
        warning: "#F59E0B",
        border: "#E2E8F0",
        overlay: "rgba(0, 0, 0, 0.5)",
      },
    },
    scheme: "light",
    getContrastingColor: (bg: string, light: string, dark: string) => {
      // Simple contrast check for testing
      return bg === "#FFFFFF" || bg === "transparent" ? dark : light;
    },
    getShadowStyle: () => ({}),
  }),
}));

describe("Button", () => {
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

    it("renders different sizes", () => {
      const sizes = ["sm", "md", "lg"] as const;

      sizes.forEach((size) => {
        const { unmount } = render(
          <Button size={size}>
            <Text>{size}</Text>
          </Button>
        );
        expect(screen.getByText(size)).toBeTruthy();
        unmount();
      });
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
