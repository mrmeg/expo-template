/**
 * themeStore tests
 *
 * Tests default state, setTheme, and persistence behavior.
 */

import { resolveThemePreference, useThemeStore } from "../themeStore";

// Reset store between tests
beforeEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light" });
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
});
