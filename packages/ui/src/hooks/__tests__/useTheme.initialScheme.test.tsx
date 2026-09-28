/**
 * `InitialSchemeProvider` / `UIProvider initialScheme`: the first-render scheme
 * hint wins until the persisted preference has been read, then the store does.
 */
import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { useTheme } from "../useTheme";
import { useThemeStore } from "../../state/themeStore";
import { InitialSchemeProvider } from "../../state/initialScheme";
import { UIProvider } from "../../components/UIProvider";

beforeEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", hasLoadedTheme: false, colorOverrides: {} });
});

describe("useTheme with an initial scheme hint", () => {
  it("renders the hinted scheme before the store has loaded", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InitialSchemeProvider scheme="dark">{children}</InitialSchemeProvider>
    );
    const { result } = await renderHook(() => useTheme(), { wrapper });
    expect(result.current.scheme).toBe("dark");
    expect(result.current.theme.dark).toBe(true);
  });

  it("hands over to the store once the preference is loaded", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InitialSchemeProvider scheme="dark">{children}</InitialSchemeProvider>
    );
    const { result } = await renderHook(() => useTheme(), { wrapper });
    await act(() => {
      useThemeStore.setState({ hasLoadedTheme: true, userTheme: "light" });
    });
    expect(result.current.scheme).toBe("light");
  });

  it("changes nothing without a hint", async () => {
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe("light");
  });

  it("reaches useTheme through UIProvider's initialScheme prop", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIProvider initialScheme="dark" notification={false} portalHost={false} statusBar={false} keyboardAvoiding={false}>
        {children}
      </UIProvider>
    );
    const { result } = await renderHook(() => useTheme(), { wrapper });
    expect(result.current.scheme).toBe("dark");
  });
});
