/**
 * TextInput component tests
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TextInput } from "../TextInput";

// Mock useTheme hook
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
        input: "#E2E8F0",
        ring: "#A1A1AA",
        overlay: "rgba(0, 0, 0, 0.5)",
      },
    },
    scheme: "light",
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
    getContrastingColor: (bg: string, light: string, dark: string) => {
      return bg === "#FFFFFF" || bg === "transparent" ? dark : light;
    },
  }),
}));

describe("TextInput", () => {
  describe("Rendering", () => {
    it("renders with placeholder", async () => {
      await render(<TextInput placeholder="Enter text" />);

      expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
    });

    it("renders with label", async () => {
      await render(<TextInput label="Username" placeholder="Enter username" />);

      expect(screen.getByText("Username")).toBeTruthy();
    });

    it("renders with value", async () => {
      await render(<TextInput value="Test value" />);

      expect(screen.getByDisplayValue("Test value")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("calls onChangeText when text changes", async () => {
      const onChangeText = jest.fn();

      await render(
        <TextInput
          placeholder="Type here"
          onChangeText={onChangeText}
        />
      );

      await fireEvent.changeText(screen.getByPlaceholderText("Type here"), "Hello");

      expect(onChangeText).toHaveBeenCalledWith("Hello");
    });

    it("calls onFocus when focused", async () => {
      const onFocus = jest.fn();

      await render(<TextInput placeholder="Focus me" onFocus={onFocus} />);

      await fireEvent(screen.getByPlaceholderText("Focus me"), "focus");

      expect(onFocus).toHaveBeenCalled();
    });

    it("calls onBlur when blurred", async () => {
      const onBlur = jest.fn();

      await render(<TextInput placeholder="Blur me" onBlur={onBlur} />);

      await fireEvent(screen.getByPlaceholderText("Blur me"), "blur");

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Secure Text Entry", () => {
    it("hides text when secureTextEntry is true", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          value="secret"
        />
      );

      const input = screen.getByPlaceholderText("Password");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("toggles visibility via the secure entry toggle", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          value="secret"
        />
      );

      const input = screen.getByPlaceholderText("Password");
      expect(input.props.secureTextEntry).toBe(true);

      // Tap the eye button -> reveals the text.
      await fireEvent.press(screen.getByLabelText("Show password"));
      expect(input.props.secureTextEntry).toBe(false);

      // Tap again -> hides it. Text persists across the toggle.
      await fireEvent.press(screen.getByLabelText("Hide password"));
      expect(input.props.secureTextEntry).toBe(true);
      expect(input.props.value).toBe("secret");
    });
  });

  describe("Disabled State", () => {
    it("is not editable when editable is false", async () => {
      await render(
        <TextInput placeholder="Disabled" editable={false} />
      );

      const input = screen.getByPlaceholderText("Disabled");
      expect(input.props.editable).toBe(false);
    });
  });
});
