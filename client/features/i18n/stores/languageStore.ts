import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "user-language-preference";

export type LanguageStore = {
  userLanguage: string | null;
  setUserLanguage: (language: string) => void;
  loadLanguage: () => Promise<string | null>;
};

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  userLanguage: null,

  setUserLanguage: (language) => {
    set({ userLanguage: language });
    if (Platform.OS !== "web") {
      AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => {});
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LANGUAGE_KEY, language);
    }
  },

  loadLanguage: async () => {
    try {
      let saved: string | null = null;
      if (Platform.OS !== "web") {
        saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      } else if (typeof window !== "undefined" && window.localStorage) {
        saved = localStorage.getItem(LANGUAGE_KEY);
      }
      if (saved) {
        set({ userLanguage: saved });
      }
      return saved;
    } catch {
      return null;
    }
  },
}));
