import { act, renderHook } from "@testing-library/react-native";

import { useTreatment } from "../useTreatment";
import { useTheme } from "../useTheme";
import { colors } from "../../constants/colors";
import { applyLook, classicLook, refinedLook } from "../../state/looks";
import { defaultTreatments, useThemeStore } from "../../state/themeStore";

afterEach(() => {
  applyLook(refinedLook);
  useThemeStore.setState({ userTheme: "system", systemTheme: "light" });
});

describe("useTreatment", () => {
  it("defaults every treatment to the Refined value", async () => {
    for (const key of Object.keys(defaultTreatments) as (keyof typeof defaultTreatments)[]) {
      const { result } = await renderHook(() => useTreatment(key));
      expect(result.current).toBe(defaultTreatments[key]);
    }
    expect(defaultTreatments).toEqual({
      segmentedSelection: "surface",
      switchTrack: "primary",
      eyebrow: "sentence",
      focusRing: "soft",
      elevation: "hairline",
    });
  });

  it("follows setTreatments and falls back when cleared", async () => {
    const { result } = await renderHook(() => useTreatment("eyebrow"));
    await act(() => useThemeStore.getState().setTreatments({ eyebrow: "uppercase" }));
    expect(result.current).toBe("uppercase");
    await act(() => useThemeStore.getState().setTreatments({}));
    expect(result.current).toBe("sentence");
  });
});

describe("classicLook", () => {
  it("sets every treatment to its pre-Refined value", () => {
    expect(classicLook.treatments).toEqual({
      segmentedSelection: "accent",
      switchTrack: "accent",
      eyebrow: "uppercase",
      focusRing: "offset",
      elevation: "layered",
    });
    expect(classicLook.shape).toEqual({ button: { borderRadius: 10 }, input: { borderRadius: 10 } });
  });

  it("covers every ThemeColors token the package ships, so Classic is complete", () => {
    for (const scheme of ["light", "dark"] as const) {
      expect(Object.keys(classicLook.colors![scheme]!).sort()).toEqual(Object.keys(colors[scheme].colors).sort());
    }
  });

  it("applyLook(classicLook) restores zinc, and applyLook(refinedLook) returns to neutral", async () => {
    const { result } = await renderHook(() => useTheme());
    expect(result.current.theme.colors.primary).toBe("#171717");

    await act(() => applyLook(classicLook));
    expect(result.current.theme.colors.primary).toBe("#18181B");
    expect(result.current.theme.colors.border).toBe("#E4E4E7");

    await act(() => applyLook(refinedLook));
    expect(result.current.theme.colors.primary).toBe("#171717");
    expect(useThemeStore.getState().treatmentOverrides).toEqual({});
  });
});
