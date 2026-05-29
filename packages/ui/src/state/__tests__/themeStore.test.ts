/**
 * themeStore tests
 *
 * Tests default state, setTheme, and persistence behavior.
 */

import { resolveThemePreference, useThemeStore } from "../themeStore";

// Reset store between tests
beforeEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", colorOverrides: {} });
});

describe("themeStore", () => {
  it("has default theme of system", () => {
    const state = useThemeStore.getState();
    expect(state.userTheme).toBe("system");
    expect(["light", "dark"]).toContain(state.systemTheme);
  });

  it("setTheme updates to light", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().userTheme).toBe("light");
  });

  it("setTheme updates to dark", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().userTheme).toBe("dark");
  });

  it("setTheme updates back to system", () => {
    useThemeStore.getState().setTheme("dark");
    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().userTheme).toBe("system");
  });

  it("loadTheme is a function", () => {
    const state = useThemeStore.getState();
    expect(typeof state.loadTheme).toBe("function");
  });

  it("updates systemTheme independently from the user preference", () => {
    useThemeStore.getState().setSystemTheme("dark");

    expect(useThemeStore.getState().userTheme).toBe("system");
    expect(useThemeStore.getState().systemTheme).toBe("dark");
  });

  it("resolves system preference to the current system theme", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark");
    expect(resolveThemePreference("system", "light")).toBe("light");
    expect(resolveThemePreference("dark", "light")).toBe("dark");
    expect(resolveThemePreference("light", "dark")).toBe("light");
  });

  describe("colorOverrides", () => {
    it("defaults to an empty override map", () => {
      expect(useThemeStore.getState().colorOverrides).toEqual({});
    });

    it("setColors stores per-scheme overrides", () => {
      useThemeStore.getState().setColors({
        light: { primary: "#7575eb" },
        dark: { primary: "#7575eb", primaryForeground: "#FFFFFF" },
      });

      const { colorOverrides } = useThemeStore.getState();
      expect(colorOverrides.light).toEqual({ primary: "#7575eb" });
      expect(colorOverrides.dark).toEqual({ primary: "#7575eb", primaryForeground: "#FFFFFF" });
    });

    it("setColors with an empty object clears overrides", () => {
      useThemeStore.getState().setColors({ dark: { primary: "#7575eb" } });
      useThemeStore.getState().setColors({});

      expect(useThemeStore.getState().colorOverrides).toEqual({});
    });

    it("setColors does not disturb the theme preference or system scheme", () => {
      useThemeStore.setState({ userTheme: "dark", systemTheme: "dark" });
      useThemeStore.getState().setColors({ dark: { primary: "#7575eb" } });

      expect(useThemeStore.getState().userTheme).toBe("dark");
      expect(useThemeStore.getState().systemTheme).toBe("dark");
    });
  });
});
