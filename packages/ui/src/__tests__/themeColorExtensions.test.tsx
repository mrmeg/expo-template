/**
 * Apps extend `ThemeColors` with their own tokens by augmenting
 * `ThemeColorExtensions` — the alternative is a side palette that drifts from
 * the theme. Three things must hold: the augmented key is typed on
 * `useTheme().theme.colors` (and an unknown key is a type error), `setColors`
 * and `ThemeColorScope` carry the runtime value through the same merge as the
 * built-in tokens, and `getThemeCssVariables` emits a `--c-*` variable for it
 * so an HTML shell can use it too.
 *
 * The augmentation targets the relative module so it applies to this package's
 * own type-check (root `bun run typecheck` includes tests): the default palettes
 * are typed on `ThemeColorTokens`, so a required extension key compiles here
 * exactly as it does in an app.
 */
import React from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import { getThemeCssVariables } from "../constants/colors";
import { useTheme } from "../hooks/useTheme";
import { ThemeColorScope } from "../state/themeColorScope";
import { useThemeStore } from "../state/themeStore";

declare module "../constants/colors" {
  interface ThemeColorExtensions {
    brandGold: string;
  }
}

function Probe() {
  const { theme } = useTheme();
  // Typed through the augmentation: no cast, no index signature. The package
  // ships no value, so it is undefined at runtime until an override sets it.
  const gold: string = theme.colors.brandGold;
  // @ts-expect-error — a key nobody declared is still a type error.
  const missing: unknown = theme.colors.notAToken;
  void missing;
  return <Text testID="gold">{gold || "unset"}</Text>;
}

describe("ThemeColorExtensions", () => {
  afterEach(() => {
    useThemeStore.getState().setColors({});
    useThemeStore.getState().setTheme("light");
  });

  it("is absent until an override provides it", async () => {
    await render(<Probe />);
    expect(screen.getByTestId("gold").props.children).toBe("unset");
  });

  it("flows through setColors for the active scheme", async () => {
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().setColors({ light: { brandGold: "#ffcc00" }, dark: { brandGold: "#ffe066" } });
    await render(<Probe />);
    expect(screen.getByTestId("gold").props.children).toBe("#ffcc00");

    await act(async () => {
      useThemeStore.getState().setTheme("dark");
    });
    expect(screen.getByTestId("gold").props.children).toBe("#ffe066");
  });

  it("flows through ThemeColorScope and wins over the global brand inside it", async () => {
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().setColors({ light: { brandGold: "#ffcc00" } });
    await render(
      <ThemeColorScope colors={{ light: { brandGold: "#c9a227" } }}>
        <Probe />
      </ThemeColorScope>,
    );
    expect(screen.getByTestId("gold").props.children).toBe("#c9a227");
  });

  it("gets a CSS variable in getThemeCssVariables when an override names it", () => {
    const css = getThemeCssVariables({ light: { brandGold: "#ffcc00" }, dark: { brandGold: "#ffe066" } });
    expect(css).toContain("--c-brand-gold: #ffcc00; --c-brand-gold-rgb: 255, 204, 0;");
    expect(css).toContain("--c-brand-gold: #ffe066; --c-brand-gold-rgb: 255, 224, 102;");
    // Built-in tokens are unchanged, and an absent extension emits nothing.
    expect(css).toContain("--c-background: #FFFFFF;");
    expect(getThemeCssVariables()).not.toContain("brand-gold");
  });
});
