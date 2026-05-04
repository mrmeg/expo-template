import { Appearance, Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "user-theme-preference";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type ThemeStore = {
  userTheme: ThemePreference;
  systemTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  setSystemTheme: (theme: ResolvedTheme) => void;
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
  systemTheme: getSystemTheme(),

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

// Load saved theme on store creation
useThemeStore.getState().loadTheme();
startSystemThemeListener();
