/**
 * Shared `useTheme` mock used by component-render tests.
 *
 * Use in any test that just needs a stable theme without mounting the
 * full theme provider stack:
 *
 *   import "@/test/mockTheme";
 *
 * The mock returns a fixed light-scheme theme so colour assertions stay
 * stable, exposes the same methods as the real `useTheme` (`getShadowStyle`,
 * `getContrastingColor`, `getContrastRatio`, `withAlpha`, `toggleTheme`,
 * `setTheme`), and is a no-op for the side-effecty members.
 */

const theme = {
  scheme: "light",
  dark: false,
  colors: {
    background: "#FFFFFF",
    foreground: "#0F172A",
    card: "#F8FAFC",
    cardForeground: "#0F172A",
    primary: "#0F172A",
    primaryForeground: "#FFFFFF",
    secondary: "#6366F1",
    secondaryForeground: "#FFFFFF",
    muted: "#F1F5F9",
    mutedForeground: "#64748B",
    accent: "#14B8A6",
    accentForeground: "#FFFFFF",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    success: "#22C55E",
    warning: "#F59E0B",
    border: "#E2E8F0",
    input: "#FFFFFF",
    ring: "#0F172A",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  fonts: {},
  navigation: {},
};

jest.mock("@mrmeg/expo-ui/hooks", () => {
  const actual = jest.requireActual("@mrmeg/expo-ui/hooks");
  return {
    ...actual,
    useTheme: () => ({
      theme,
      scheme: "light",
      getShadowStyle: () => ({}),
      getContrastingColor: (
        _bg: string,
        _light = "#FFFFFF",
        dark = "#0F172A",
      ) => dark,
      getContrastRatio: () => 4.5,
      withAlpha: (color: string) => color,
      toggleTheme: jest.fn(),
      setTheme: jest.fn(),
      currentTheme: "light",
    }),
    __esModule: true,
  };
});

export {};
