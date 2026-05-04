/**
 * useTheme hook tests
 *
 * Tests the theme hook's color utilities, shadow generation,
 * and contrast calculation functions.
 */

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { useStyles, useTheme } from "../useTheme";
import { colors } from "../../constants/colors";
import { useThemeStore } from "../../state/themeStore";

beforeEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light" });
});

describe("useTheme", () => {
  describe("theme object", () => {
    it("returns a theme with expected color keys", () => {
      const { result } = renderHook(() => useTheme());
      const { theme } = result.current;

      expect(theme.colors).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.foreground).toBeDefined();
      expect(theme.colors.popover).toBeDefined();
      expect(theme.colors.popoverForeground).toBeDefined();
      expect(theme.colors.primary).toBeDefined();
      expect(theme.colors.accent).toBeDefined();
      expect(theme.colors.destructive).toBeDefined();
      expect(theme.colors.muted).toBeDefined();
      expect(theme.colors.border).toBeDefined();
      expect(theme.colors.input).toBeDefined();
      expect(theme.colors.ring).toBeDefined();
    });

    it("returns a scheme value of light or dark", () => {
      const { result } = renderHook(() => useTheme());
      expect(["light", "dark"]).toContain(result.current.scheme);
    });

    it("returns a currentTheme value", () => {
      const { result } = renderHook(() => useTheme());
      expect(["system", "light", "dark"]).toContain(result.current.currentTheme);
    });

    it("updates system theme consumers while currentTheme stays system", () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.currentTheme).toBe("system");
      expect(result.current.scheme).toBe("light");

      act(() => {
        useThemeStore.getState().setSystemTheme("dark");
      });

      expect(result.current.currentTheme).toBe("system");
      expect(result.current.scheme).toBe("dark");
      expect(result.current.theme).toBe(colors.dark);
    });

    it("ignores system theme changes when the user selected an explicit theme", () => {
      useThemeStore.setState({ userTheme: "light", systemTheme: "light" });

      const { result } = renderHook(() => useTheme());

      act(() => {
        useThemeStore.getState().setSystemTheme("dark");
      });

      expect(result.current.currentTheme).toBe("light");
      expect(result.current.scheme).toBe("light");
      expect(result.current.theme).toBe(colors.light);
    });

    it("keeps helper identities stable across unchanged rerenders", () => {
      const { result, rerender } = renderHook(() => useTheme());
      const first = result.current;

      rerender({});

      expect(result.current.getShadowStyle).toBe(first.getShadowStyle);
      expect(result.current.getFocusRingStyle).toBe(first.getFocusRingStyle);
      expect(result.current.getContrastingColor).toBe(first.getContrastingColor);
      expect(result.current.getContrastRatio).toBe(first.getContrastRatio);
    });

    it("keeps secondary neutral and accent teal across themes", () => {
      expect(colors.light.colors.secondary).toBe("#F4F4F5");
      expect(colors.light.colors.secondaryForeground).toBe("#18181B");
      expect(colors.light.colors.accent).toBe("#14b8a6");
      expect(colors.dark.colors.secondary).toBe("#27272A");
      expect(colors.dark.colors.secondaryForeground).toBe("#FAFAFA");
      expect(colors.dark.colors.accent).toBe("#2dd4bf");
    });
  });

  describe("getShadowStyle", () => {
    it("returns an object for each shadow type", () => {
      const { result } = renderHook(() => useTheme());
      const types = [
        "base",
        "soft",
        "sharp",
        "subtle",
        "elevated",
        "glow",
        "glass",
        "card",
        "cardHover",
        "cardSubtle",
      ] as const;

      types.forEach((type) => {
        const style = result.current.getShadowStyle(type);
        expect(typeof style).toBe("object");
      });
    });

    it("returns CSS boxShadow on web platform", () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "web",
      });

      const { result } = renderHook(() => useTheme());
      const style = result.current.getShadowStyle("base") as Record<string, unknown>;

      expect(style.boxShadow).toEqual(expect.stringContaining("rgba"));

      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalOS,
      });
    });
  });

  describe("useStyles", () => {
    it("passes withAlpha into the style factory context", () => {
      const { result } = renderHook(() =>
        useStyles(({ theme, spacing, withAlpha }) => ({
          card: {
            backgroundColor: withAlpha(theme.colors.primary, 0.08),
            padding: spacing.sm,
          },
        }))
      );

      const cardStyle = StyleSheet.flatten(result.current.styles.card);

      expect(cardStyle.backgroundColor).toBe(result.current.withAlpha(result.current.theme.colors.primary, 0.08));
      expect(cardStyle.padding).toBe(result.current.spacing.sm);
    });
  });

  describe("getFocusRingStyle", () => {
    it("returns CSS focus ring on web platform", () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "web",
      });

      const { result } = renderHook(() => useTheme());
      const style = result.current.getFocusRingStyle() as Record<string, unknown>;

      expect(style.boxShadow).toEqual(expect.stringContaining("0 0 0 4px"));

      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalOS,
      });
    });
  });

  describe("withAlpha", () => {
    it("produces valid rgba strings from hex colors", () => {
      const { result } = renderHook(() => useTheme());
      const rgba = result.current.withAlpha("#336699", 0.6);

      expect(rgba).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.6\)$/);
    });

    it("handles full opacity", () => {
      const { result } = renderHook(() => useTheme());
      const rgba = result.current.withAlpha("#000000", 1);

      expect(rgba).toMatch(/^rgba\(0,\s*0,\s*0,\s*1\)$/);
    });

    it("handles zero opacity", () => {
      const { result } = renderHook(() => useTheme());
      const rgba = result.current.withAlpha("#FFFFFF", 0);

      expect(rgba).toMatch(/^rgba\(255,\s*255,\s*255,\s*0\)$/);
    });
  });

  describe("getContrastRatio", () => {
    it("returns 21 for black vs white", () => {
      const { result } = renderHook(() => useTheme());
      const ratio = result.current.getContrastRatio("#000000", "#FFFFFF");

      expect(ratio).toBeCloseTo(21, 0);
    });

    it("returns 1 for identical colors", () => {
      const { result } = renderHook(() => useTheme());
      const ratio = result.current.getContrastRatio("#336699", "#336699");

      expect(ratio).toBeCloseTo(1, 0);
    });
  });

  describe("getContrastingColor", () => {
    it("picks the higher-contrast color against a light background", () => {
      const { result } = renderHook(() => useTheme());
      const color = result.current.getContrastingColor("#FFFFFF", "#000000", "#EEEEEE");

      expect(color).toBe("#000000");
    });

    it("picks the higher-contrast color against a dark background", () => {
      const { result } = renderHook(() => useTheme());
      const color = result.current.getContrastingColor("#000000", "#000000", "#FFFFFF");

      expect(color).toBe("#FFFFFF");
    });
  });

  describe("getTextColorForBackground", () => {
    it("returns 'light' for dark backgrounds", () => {
      const { result } = renderHook(() => useTheme());
      const textColor = result.current.getTextColorForBackground("#000000");

      expect(textColor).toBe("light");
    });

    it("returns 'dark' for light backgrounds", () => {
      const { result } = renderHook(() => useTheme());
      const textColor = result.current.getTextColorForBackground("#FFFFFF");

      expect(textColor).toBe("dark");
    });
  });
});
