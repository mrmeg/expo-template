/**
 * ThemeSelector tests
 *
 * The control reads and writes the theme store by default, takes over when
 * controlled, and exposes each segment as a labelled radio.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { ThemeSelector } from "../ThemeSelector";
import { Item, ItemActions, ItemContent, ItemTitle } from "../Item";
import { useThemeStore } from "../../state/themeStore";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        ring: "#A1A1AA",
      },
    },
    getFocusRingStyle: () => ({}),
  }),
}));

jest.mock("../../lib/haptics", () => ({ hapticSelection: jest.fn() }));

const { hapticSelection } = jest.requireMock("../../lib/haptics") as { hapticSelection: jest.Mock };

describe("ThemeSelector", () => {
  beforeEach(async () => {
    hapticSelection.mockClear();
    await act(async () => {
      useThemeStore.setState({ userTheme: "system" });
    });
  });

  it("marks the store's preference as the checked radio", async () => {
    await render(<ThemeSelector />);

    expect(screen.getByTestId("theme-selector-system").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("theme-selector-dark").props.accessibilityState).toMatchObject({ checked: false });
  });

  it("writes the chosen preference to the store", async () => {
    const setTheme = jest.fn();
    useThemeStore.setState({ setTheme });
    await render(<ThemeSelector />);

    await fireEvent.press(screen.getByTestId("theme-selector-dark"));

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(hapticSelection).toHaveBeenCalledTimes(1);
  });

  it("ignores a press on the selected segment", async () => {
    const onValueChange = jest.fn();
    await render(<ThemeSelector value="light" onValueChange={onValueChange} />);

    await fireEvent.press(screen.getByTestId("theme-selector-light"));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

  it("uses value and onValueChange when controlled", async () => {
    const onValueChange = jest.fn();
    await render(<ThemeSelector value="dark" onValueChange={onValueChange} />);

    expect(screen.getByTestId("theme-selector-dark").props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId("theme-selector-system"));
    expect(onValueChange).toHaveBeenCalledWith("system");
  });

  it("labels segments for screen readers and shows text only with showLabels", async () => {
    const labels = { system: "Sistema", light: "Claro", dark: "Oscuro" };
    const { rerender } = await render(<ThemeSelector labels={labels} />);

    expect(screen.getByLabelText("Oscuro")).toBeTruthy();
    expect(screen.queryByText("Oscuro")).toBeNull();

    await rerender(<ThemeSelector labels={labels} showLabels />);
    expect(screen.getByText("Oscuro")).toBeTruthy();
  });

  it("blocks presses when disabled", async () => {
    const onValueChange = jest.fn();
    await render(<ThemeSelector value="system" onValueChange={onValueChange} disabled />);

    await fireEvent.press(screen.getByTestId("theme-selector-light"));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("takes the row title as the group's label inside an Item", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Theme</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ThemeSelector />
        </ItemActions>
      </Item>,
    );

    expect(screen.getByTestId("theme-selector").props.accessibilityLabel).toBe("Theme");
  });

  it("keeps its own accessibilityLabel over the row title", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Theme</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ThemeSelector accessibilityLabel="Appearance" />
        </ItemActions>
      </Item>,
    );

    expect(screen.getByTestId("theme-selector").props.accessibilityLabel).toBe("Appearance");
  });
});
