/**
 * Looks screen smoke tests: the screen mounts on the package default, picking
 * a look applies it to the theme store, and leaving restores Refined.
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

jest.mock("@expo/ui/community/segmented-control", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    SegmentedControl: ({ values, onValueChange }: { values: string[]; onValueChange: (value: string) => void }) => (
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

import LooksScreen from "../LooksScreen";

afterEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light" });
});

describe("LooksScreen", () => {
  it("opens on Refined with the Home sample and lists all five looks", async () => {
    await render(<LooksScreen />);

    for (const name of ["Refined", "Classic", "Strand", "Glass", "Editorial"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("2,481")).toBeTruthy();
    expect(useThemeStore.getState().colorOverrides).toEqual({});
  });

  it("applies a picked look, switches the sample, and restores Refined on unmount", async () => {
    const view = await render(<LooksScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("look-strand"));
    });
    expect(useThemeStore.getState().colorOverrides.light?.accent).toBe("#0a6aa6");
    expect(useThemeStore.getState().shapeOverrides.card).toEqual({ borderRadius: 2 });

    await act(async () => {
      fireEvent.press(screen.getAllByText("Settings")[0]);
    });
    expect(screen.getByText(/Account/)).toBeTruthy();

    await view.unmount();
    expect(useThemeStore.getState().colorOverrides).toEqual({});
    expect(useThemeStore.getState().shapeOverrides).toEqual({});
    expect(useThemeStore.getState().treatmentOverrides).toEqual({});
  });
});
