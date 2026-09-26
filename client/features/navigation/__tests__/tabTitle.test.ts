/**
 * The `(tabs)` stack screen is the only header above the native tab bar, so its
 * title has to follow the focused tab; a fixed "Explore" labelled every tab.
 * Each tab screen calls `useTabHeaderTitle` and the parent stack's options get
 * the tab's label on focus.
 */
import { renderHook } from "@testing-library/react-native";

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ getParent: () => ({ setOptions: mockSetOptions }) }),
  // Run the focus effect as if the screen were focused on mount.
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual("react") as typeof import("react");
    React.useEffect(() => {
      const cleanup = effect();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, [effect]);
  },
}));

import { tabTitleFor, useTabHeaderTitle } from "../tabTitle";

describe("tabTitleFor", () => {
  it("maps each tab to its destination label", () => {
    expect(tabTitleFor("index")).toBe("Explore");
    expect(tabTitleFor("media")).toBe("Media");
    expect(tabTitleFor("profile")).toBe("Profile");
    expect(tabTitleFor("settings")).toBe("Settings");
  });

  it("defaults to Explore for an unknown or missing tab", () => {
    expect(tabTitleFor("nope")).toBe("Explore");
    expect(tabTitleFor(undefined)).toBe("Explore");
  });
});

describe("useTabHeaderTitle", () => {
  beforeEach(() => mockSetOptions.mockClear());

  it("sets the parent stack header title to the focused tab's label", async () => {
    await renderHook(() => useTabHeaderTitle("profile"));
    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Profile" });
  });

  it("follows the tab it is called for", async () => {
    await renderHook(() => useTabHeaderTitle("settings"));
    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: "Settings" });
  });
});
