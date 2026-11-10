/**
 * Contrast level in `useTheme`.
 *
 * "More" contrast layers a few token overrides (`contrastColorOverrides`) on
 * top of light/dark. On native the base theme changes; store and scoped color
 * overrides still spread on top, so an app's own value for a token wins.
 */
import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { useStyles, useTheme } from "../useTheme";
import { colors, palette } from "../../constants/colors";
import { useThemeStore } from "../../state/themeStore";
import { ThemeColorScope } from "../../state/themeColorScope";

beforeEach(() => {
  useThemeStore.setState({
    userTheme: "system",
    systemTheme: "light",
    userContrast: "system",
    systemContrast: "standard",
    hasLoadedTheme: true,
    colorOverrides: {},
    treatmentOverrides: {},
  });
});

describe("useTheme contrast", () => {
  it("resolves to standard by default and returns the base theme by reference", async () => {
    const { result } = await renderHook(() => useTheme());

    expect(result.current.contrast).toBe("standard");
    expect(result.current.currentContrast).toBe("system");
    expect(result.current.theme).toBe(colors.light);
  });

  it("follows the OS contrast while the preference is system", async () => {
    const { result } = await renderHook(() => useTheme());

    await act(() => {
      useThemeStore.getState().setSystemContrast("more");
    });

    expect(result.current.contrast).toBe("more");
    expect(result.current.currentContrast).toBe("system");
    expect(result.current.theme.colors.accent).toBe(palette.teal700);
  });

  it("uses the light overrides in light under more contrast", async () => {
    useThemeStore.setState({ userContrast: "more" });
    const { result } = await renderHook(() => useTheme());
    const { colors: themed } = result.current.theme;

    expect(themed.accent).toBe(palette.teal700);
    expect(themed.warning).toBe(palette.amber700);
    expect(themed.ring).toBe(palette.neutral900);
    expect(themed.accentForeground).toBe(palette.white);
    expect(themed.destructiveForeground).toBe(colors.light.colors.destructiveForeground);
    expect(result.current.theme.dark).toBe(false);
  });

  it("uses the dark overrides in dark under more contrast", async () => {
    useThemeStore.setState({ userTheme: "dark", userContrast: "more" });
    const { result } = await renderHook(() => useTheme());
    const { colors: themed } = result.current.theme;

    expect(themed.destructiveForeground).toBe(palette.neutral900);
    expect(themed.ring).toBe(palette.neutral300);
    expect(themed.accent).toBe(colors.dark.colors.accent);
    expect(result.current.theme.dark).toBe(true);
  });

  it("lets the user force standard over a more OS setting", async () => {
    useThemeStore.setState({ userContrast: "standard", systemContrast: "more" });
    const { result } = await renderHook(() => useTheme());

    expect(result.current.contrast).toBe("standard");
    expect(result.current.theme).toBe(colors.light);
  });

  it("switches with setContrast", async () => {
    const { result } = await renderHook(() => useTheme());

    await act(() => {
      result.current.setContrast("more");
    });
    expect(result.current.contrast).toBe("more");
    expect(result.current.currentContrast).toBe("more");
    expect(result.current.theme.colors.accent).toBe(palette.teal700);

    await act(() => {
      result.current.setContrast("standard");
    });
    expect(result.current.theme).toBe(colors.light);
  });

  it("keeps an app's setColors override over the contrast override", async () => {
    useThemeStore.setState({
      userContrast: "more",
      colorOverrides: { light: { accent: "#ff00aa" } },
    });
    const { result } = await renderHook(() => useTheme());

    expect(result.current.theme.colors.accent).toBe("#ff00aa");
    // Tokens the app leaves alone still get the contrast value.
    expect(result.current.theme.colors.warning).toBe(palette.amber700);
  });

  it("keeps a ThemeColorScope override over the contrast override", async () => {
    useThemeStore.setState({ userContrast: "more" });
    const { result } = await renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ThemeColorScope colors={{ light: { ring: "#00ff00" } }}>{children}</ThemeColorScope>
      ),
    });

    expect(result.current.theme.colors.ring).toBe("#00ff00");
    expect(result.current.theme.colors.accent).toBe(palette.teal700);
  });

  it("passes contrast through useStyles", async () => {
    useThemeStore.setState({ userContrast: "more" });
    const { result } = await renderHook(() => useStyles(() => ({ box: { padding: 1 } })));

    expect(result.current.contrast).toBe("more");
    expect(result.current.currentContrast).toBe("more");
    expect(typeof result.current.setContrast).toBe("function");
  });

  it("keeps helper identities stable until the contrast changes", async () => {
    const { result, rerender } = await renderHook(() => useTheme());
    const before = result.current;

    await rerender({});
    expect(result.current.getContrastRatio).toBe(before.getContrastRatio);

    await act(() => {
      useThemeStore.getState().setContrast("more");
    });
    expect(result.current.getContrastRatio).not.toBe(before.getContrastRatio);
    expect(result.current.getContrastingColor).not.toBe(before.getContrastingColor);
    expect(result.current.getTextColorForBackground).not.toBe(before.getTextColorForBackground);
  });
});
