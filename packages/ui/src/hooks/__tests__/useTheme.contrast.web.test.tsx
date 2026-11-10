/**
 * Contrast level in `useTheme` on web.
 *
 * Web theme colors are `var(--c-*)` references and CSS re-themes them on
 * `data-contrast`, so both contrast levels must hand back the SAME theme
 * objects: memoized styles must not churn when the level changes. The raw-color
 * helpers still resolve against the active level.
 */
// Must be the first import: `colors` resolves its platform at module load.
import "../../components/__tests__/forceWebPlatform";
import { act, renderHook } from "@testing-library/react-native";
import { useTheme } from "../useTheme";
import { colors, palette } from "../../constants/colors";
import { useThemeStore } from "../../state/themeStore";

beforeEach(() => {
  useThemeStore.setState({
    userTheme: "system",
    systemTheme: "light",
    userContrast: "system",
    systemContrast: "standard",
    hasLoadedTheme: true,
    colorOverrides: {},
  });
});

describe("useTheme contrast (web)", () => {
  it("returns the same theme object at both contrast levels", async () => {
    const { result } = await renderHook(() => useTheme());
    const standard = result.current.theme;
    expect(standard).toBe(colors.light);

    await act(() => {
      useThemeStore.getState().setContrast("more");
    });

    expect(result.current.contrast).toBe("more");
    expect(result.current.theme).toBe(standard);
    expect(result.current.theme.colors.accent).toBe("var(--c-accent)");
  });

  it("resolves var() colors against the contrast level in the helpers", async () => {
    const { result } = await renderHook(() => useTheme());
    const standardRatio = result.current.getContrastRatio("var(--c-accent)", palette.white);

    await act(() => {
      useThemeStore.getState().setContrast("more");
    });

    expect(result.current.getContrastRatio("var(--c-accent)", palette.white)).toBeGreaterThan(standardRatio);
    expect(result.current.getContrastRatio("var(--c-accent)", palette.white)).toBeGreaterThanOrEqual(4.5);
  });
});
