/**
 * Surface Lab screen smoke tests.
 *
 * Mounts the real screen in both schemes, then checks the contract it shares
 * with `ThemedShowcaseScreen`: the picked candidates reach the theme store
 * through `setColors`, and unmounting clears them.
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

// jest-expo reports Platform.OS === "ios", so SegmentedControl routes to the
// native @expo/ui community module. Stand it in with pressable segments.
jest.mock("@expo/ui/community/segmented-control", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    SegmentedControl: ({
      values,
      onValueChange,
    }: {
      values: string[];
      onValueChange: (value: string) => void;
    }) => (
      <View>
        {values.map((value) => (
          <Pressable key={value} accessibilityRole="button" onPress={() => onValueChange(value)}>
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

import SurfaceLabScreen from "../SurfaceLabScreen";

const SCHEMES = ["light", "dark"] as const;

function setScheme(scheme: (typeof SCHEMES)[number]) {
  useThemeStore.setState({ userTheme: scheme, systemTheme: scheme, colorOverrides: {} });
}

afterEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", colorOverrides: {} });
});

describe.each(SCHEMES)("Surface Lab (%s)", (scheme) => {
  beforeEach(() => {
    setScheme(scheme);
  });

  it("renders the explainer, the tier ladder, and every specimen", async () => {
    await render(<SurfaceLabScreen />);

    expect(screen.getByText("Depth you can tune")).toBeTruthy();
    expect(screen.getByText("Tier ladder")).toBeTruthy();
    expect(screen.getByText("surfaceSunken")).toBeTruthy();
    expect(screen.getByText("borderStrong")).toBeTruthy();
    expect(screen.getByText("Cards on background")).toBeTruthy();
    expect(screen.getByText("Muted on card")).toBeTruthy();
    expect(screen.getByText("Popover over card")).toBeTruthy();
    expect(screen.getByText("Toast")).toBeTruthy();
    expect(screen.getByText("ItemGroup")).toBeTruthy();
  });
});

describe("Surface Lab color overrides", () => {
  beforeEach(() => {
    setScheme("dark");
  });

  it("applies the package default ramps (current dark and light) on mount", async () => {
    await render(<SurfaceLabScreen />);

    const { colorOverrides } = useThemeStore.getState();
    expect(colorOverrides.dark?.background).toBe("#09090B");
    expect(colorOverrides.dark?.popover).toBe("#18181B");
    expect(colorOverrides.light?.background).toBe("#FFFFFF");
    expect(colorOverrides.light?.card).toBe("#FFFFFF");
  });

  it("re-applies when a different candidate is picked", async () => {
    await render(<SurfaceLabScreen />);

    await fireEvent.press(screen.getByText("D Deep"));
    expect(useThemeStore.getState().colorOverrides.dark?.background).toBe("#0A0A0C");

    await fireEvent.press(screen.getByText("C Canvas"));
    expect(useThemeStore.getState().colorOverrides.light?.background).toBe("#F9F9FB");
  });

  it("clears the overrides on unmount", async () => {
    const view = await render(<SurfaceLabScreen />);
    expect(useThemeStore.getState().colorOverrides.dark).toBeDefined();

    await act(async () => {
      view.unmount();
    });

    expect(useThemeStore.getState().colorOverrides).toEqual({});
  });
});
