/**
 * Settings "Increase contrast" row: the switch shows the RESOLVED contrast and
 * a toggle that lands on the device's own level goes back to following the
 * device. (`react-i18next` is mocked in test/setup.ts: `t` returns the key.)
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import SettingsRoute from "@/app/(main)/(tabs)/settings";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ getParent: () => undefined }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const SWITCH = "settings-contrast-switch";

beforeEach(() => {
  useThemeStore.setState({
    userTheme: "system",
    systemTheme: "light",
    userContrast: "system",
    systemContrast: "standard",
    hasLoadedTheme: true,
  });
});

describe("Settings contrast row", () => {
  it("shows the resolved level and the matches-device note while following the device", async () => {
    await render(<SettingsRoute />);

    expect(screen.getByText("settings.contrastTitle")).toBeTruthy();
    expect(screen.getByText("settings.contrastMatchesDevice")).toBeTruthy();
    expect(screen.getByTestId(SWITCH).props.accessibilityState?.checked).toBe(false);

    await act(() => {
      useThemeStore.getState().setSystemContrast("more");
    });
    expect(screen.getByTestId(SWITCH).props.accessibilityState?.checked).toBe(true);
  });

  it("forces more when the device is standard, and returns to the device on toggling back", async () => {
    await render(<SettingsRoute />);

    await fireEvent.press(screen.getByTestId(SWITCH));
    expect(useThemeStore.getState().userContrast).toBe("more");
    expect(screen.queryByText("settings.contrastMatchesDevice")).toBeNull();
    expect(screen.getByTestId(SWITCH).props.accessibilityState?.checked).toBe(true);

    await fireEvent.press(screen.getByTestId(SWITCH));
    expect(useThemeStore.getState().userContrast).toBe("system");
    expect(screen.getByText("settings.contrastMatchesDevice")).toBeTruthy();
  });

  it("forces standard when the device asks for more, and follows the device when toggled back", async () => {
    useThemeStore.setState({ systemContrast: "more" });
    await render(<SettingsRoute />);

    await fireEvent.press(screen.getByTestId(SWITCH));
    expect(useThemeStore.getState().userContrast).toBe("standard");
    expect(screen.getByTestId(SWITCH).props.accessibilityState?.checked).toBe(false);

    await fireEvent.press(screen.getByTestId(SWITCH));
    expect(useThemeStore.getState().userContrast).toBe("system");
  });
});
