import { Appearance, Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ThemeColors } from "../constants/colors";

const THEME_KEY = "user-theme-preference";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Per-scheme color overrides a host app can inject to brand the package.
 *
 * The package ships a neutral default palette (see `constants/colors.ts`).
 * A consuming app almost always has its own brand palette; without a way to
 * push it in, package components (Badge, Button, inputs, …) render with the
 * package's colors while app-authored siblings render with the app's — the
 * two disagree on what e.g. `primary` means, producing collisions such as
 * white text on a white badge. `setColors` lets the app forward its palette
 * once so every package component resolves against the same source of truth.
 *
 * Each scheme is `Partial<ThemeColors>`: only the keys provided are overridden,
 * so an app can re-skin `primary`/`accent` while inheriting neutral defaults.
 */
export type ColorOverrides = {
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
};

export type ThemeStore = {
  userTheme: ThemePreference;
  systemTheme: ResolvedTheme;
  /**
   * App-injected palette overrides, applied by `useTheme` on top of the
   * package defaults. Empty by default — zero override means the package
   * behaves exactly as before this field existed (fully backward compatible).
   */
  colorOverrides: ColorOverrides;
  setTheme: (theme: ThemePreference) => void;
  setSystemTheme: (theme: ResolvedTheme) => void;
  /**
   * Replace the active color overrides. Pass `{}` (or omit both schemes) to
   * clear overrides and fall back to the package defaults.
   */
  setColors: (overrides: ColorOverrides) => void;
  loadTheme: () => void;
};

export function resolveThemePreference(
  userTheme: ThemePreference,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return userTheme === "system" ? systemTheme : userTheme;
}

function getSystemTheme(): ResolvedTheme {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export const useThemeStore = create<ThemeStore>((set) => ({
  userTheme: "system",
  // Always start with "light" so SSR and the first client render agree.
  // Real values are populated by `syncThemeFromEnvironment()` after mount.
  systemTheme: "light",

  // No overrides by default: the package renders with its built-in palette
  // until a host app calls `setColors`.
  colorOverrides: {},

  setColors: (overrides) => {
    set({ colorOverrides: overrides ?? {} });
  },

  setTheme: (theme) => {
    set({
      userTheme: theme,
      ...(theme === "system" ? { systemTheme: getSystemTheme() } : {}),
    });
    // Save directly when setting theme
    if (Platform.OS !== "web") {
      AsyncStorage.setItem(THEME_KEY, theme).catch(() => {
        // Silently fail if storage is not available
      });
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(THEME_KEY, theme);
    }
  },

  setSystemTheme: (theme) => {
    set({ systemTheme: theme });
  },

  loadTheme: () => {
    if (Platform.OS !== "web") {
      AsyncStorage.getItem(THEME_KEY).then((saved) => {
        if (saved && (saved === "system" || saved === "light" || saved === "dark")) {
          set({ userTheme: saved });
        }
      }).catch(() => {
        // Use default if loading fails
      });
    } else if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && (saved === "system" || saved === "light" || saved === "dark")) {
        set({ userTheme: saved });
      }
    }
  }
}));

let stopSystemThemeListener: (() => void) | null = null;

export function syncSystemTheme(): void {
  useThemeStore.getState().setSystemTheme(getSystemTheme());
}

export function startSystemThemeListener(): () => void {
  if (stopSystemThemeListener) {
    return stopSystemThemeListener;
  }

  syncSystemTheme();

  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      useThemeStore.getState().setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      stopSystemThemeListener = () => {
        mediaQuery.removeEventListener("change", onChange);
        stopSystemThemeListener = null;
      };
    } else {
      mediaQuery.addListener(onChange);
      stopSystemThemeListener = () => {
        mediaQuery.removeListener(onChange);
        stopSystemThemeListener = null;
      };
    }

    return stopSystemThemeListener;
  }

  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    useThemeStore.getState().setSystemTheme(colorScheme === "dark" ? "dark" : "light");
  });

  stopSystemThemeListener = () => {
    subscription.remove();
    stopSystemThemeListener = null;
  };

  return stopSystemThemeListener;
}

// Single entry point for host apps to populate the store from the
// environment (persisted preference + OS color scheme listener). Safe to
// call multiple times — `startSystemThemeListener` is idempotent — and
// returns the unsubscribe so it can be used directly inside `useEffect`.
export function syncThemeFromEnvironment(): () => void {
  useThemeStore.getState().loadTheme();
  return startSystemThemeListener();
}

// Native has no SSR mismatch concern, so keep the historical auto-init
// behavior there. On web the host app must call `syncThemeFromEnvironment()`
// from a top-level `useEffect` to avoid hydration mismatches.
if (Platform.OS !== "web") {
  useThemeStore.getState().loadTheme();
  startSystemThemeListener();
}
