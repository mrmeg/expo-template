import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "user-theme-preference";

export type ThemeStore = {
  userTheme: "system" | "light" | "dark";
  setTheme: (theme: "system" | "light" | "dark") => void;
  loadTheme: () => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  userTheme: "system",

  setTheme: (theme) => {
    set({ userTheme: theme });
    // Save directly when setting theme
    if (Platform.OS !== 'web') {
      AsyncStorage.setItem(THEME_KEY, theme).catch(() => {
        // Silently fail if storage is not available
      });
    } else if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(THEME_KEY, theme);
    }
  },

  loadTheme: () => {
    if (Platform.OS !== 'web') {
      AsyncStorage.getItem(THEME_KEY).then((saved) => {
        if (saved && (saved === "system" || saved === "light" || saved === "dark")) {
          set({ userTheme: saved });
        }
      }).catch(() => {
        // Use default if loading fails
      });
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && (saved === "system" || saved === "light" || saved === "dark")) {
        set({ userTheme: saved });
      }
    }
  }
}));

// Load saved theme on store creation
useThemeStore.getState().loadTheme();