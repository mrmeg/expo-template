/**
 * Looks screens: the index lists the five looks and applies none of them; a
 * detail page applies its look while focused, re-applies when the id changes,
 * and restores Refined when it blurs.
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import { DEMO_LOOKS } from "../looks";

const mockRoute: { id?: string } = {};
const mockPush = jest.fn();

// `useFocusEffect` runs on mount and cleans up on unmount, which is what focus
// and blur do to a stack screen; a changed callback (a new id) re-runs it.
jest.mock("expo-router", () => {
  const React_ = require("react");
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), setParams: jest.fn() }),
    useLocalSearchParams: () => mockRoute,
    useFocusEffect: (effect: () => void | (() => void)) => React_.useEffect(effect, [effect]),
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: { Screen: () => null },
  };
});

jest.mock("../looks/loadLookFonts", () => ({ loadLookFonts: jest.fn(() => Promise.resolve()) }));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

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

import LookDetailScreen from "../LookDetailScreen";
import LooksScreen from "../LooksScreen";

const store = () => useThemeStore.getState();

afterEach(() => {
  mockRoute.id = undefined;
  mockPush.mockClear();
  store().setColors({});
  store().setShape({});
  store().setTreatments({});
  useThemeStore.setState({ userTheme: "system", systemTheme: "light" });
});

describe("LooksScreen (index)", () => {
  it("lists the five looks as tiles with a Default badge on Refined, and applies none", async () => {
    await render(<LooksScreen />);

    for (const { look } of DEMO_LOOKS) {
      expect(screen.getByTestId(`look-${look.id}`)).toBeTruthy();
      expect(screen.getByText(look.name)).toBeTruthy();
    }
    expect(DEMO_LOOKS).toHaveLength(5);
    expect(screen.getAllByText("Default")).toHaveLength(1);
    expect(screen.getByText(/Refined is the default/)).toBeTruthy();

    // Nothing is applied: the index stays in the package default.
    expect(store().colorOverrides).toEqual({});
    expect(store().shapeOverrides).toEqual({});
    expect(store().treatmentOverrides).toEqual({});
    expect(store().sansPreset).toBe("geist");
  });
});

describe("LookDetailScreen", () => {
  it("applies the look on focus, shows every section, and restores Refined on blur", async () => {
    mockRoute.id = "strand";
    const view = await render(<LookDetailScreen />);

    await act(async () => {});
    expect(store().colorOverrides.light?.accent).toBe("#0a6aa6");
    expect(store().shapeOverrides.card).toEqual({ borderRadius: 2 });

    expect(screen.getByText("The whole app takes this look while this page is open.")).toBeTruthy();
    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByTestId("look-detail-colors")).toBeTruthy();
    expect(screen.getByTestId("look-color-accent")).toBeTruthy();
    expect(screen.getByTestId("look-detail-roles")).toBeTruthy();
    expect(screen.getByTestId("look-shape-card")).toBeTruthy();
    expect(screen.getByTestId("look-treatment-elevation")).toBeTruthy();
    expect(screen.getByText(/applyLook\(strandLook\)/)).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();

    await view.unmount();
    expect(store().colorOverrides).toEqual({});
    expect(store().shapeOverrides).toEqual({});
    expect(store().treatmentOverrides).toEqual({});
  });

  it("shows Refined's reference values although it applies no overrides", async () => {
    mockRoute.id = "refined";
    await render(<LookDetailScreen />);
    await act(async () => {});

    expect(store().colorOverrides).toEqual({});
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText(/applyLook\(refinedLook\)/)).toBeTruthy();
  });

  it("re-applies when the id changes", async () => {
    mockRoute.id = "strand";
    const view = await render(<LookDetailScreen />);
    await act(async () => {});
    expect(store().shapeOverrides.card).toEqual({ borderRadius: 2 });

    mockRoute.id = "glass";
    await view.rerender(<LookDetailScreen />);
    await act(async () => {});
    expect(store().shapeOverrides.card).toEqual({ borderRadius: 24 });
    expect(store().colorOverrides.light?.accent).toBe("#0d9488");

    mockRoute.id = "refined";
    await view.rerender(<LookDetailScreen />);
    await act(async () => {});
    expect(store().colorOverrides).toEqual({});
  });

  it("links to the neighbouring looks", async () => {
    mockRoute.id = "refined";
    await render(<LookDetailScreen />);

    await fireEvent.press(screen.getByTestId("look-detail-next"));
    expect(mockPush).toHaveBeenCalledWith("/(main)/(demos)/looks/classic");
    await fireEvent.press(screen.getByTestId("look-detail-previous"));
    expect(mockPush).toHaveBeenLastCalledWith("/(main)/(demos)/looks/editorial");
  });

  it("shows a not-found state for an unknown id and applies nothing", async () => {
    mockRoute.id = "nope";
    await render(<LookDetailScreen />);
    await act(async () => {});

    expect(screen.getByTestId("look-detail-missing")).toBeTruthy();
    expect(screen.getByText("No such look")).toBeTruthy();
    expect(screen.getByTestId("look-detail-back")).toBeTruthy();
    expect(store().colorOverrides).toEqual({});
  });
});
