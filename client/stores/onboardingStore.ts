import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "has-seen-onboarding";

export type OnboardingStore = {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
  loadOnboarding: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  hasSeenOnboarding: false,

  setHasSeenOnboarding: (seen) => {
    set({ hasSeenOnboarding: seen });
    if (Platform.OS !== "web") {
      AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(seen)).catch(() => {});
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(seen));
    }
  },

  loadOnboarding: () => {
    if (Platform.OS !== "web") {
      AsyncStorage.getItem(ONBOARDING_KEY)
        .then((saved) => {
          if (saved !== null) {
            set({ hasSeenOnboarding: JSON.parse(saved) });
          }
        })
        .catch(() => {});
    } else if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      if (saved !== null) {
        set({ hasSeenOnboarding: JSON.parse(saved) });
      }
    }
  },
}));

// Load saved state on store creation
useOnboardingStore.getState().loadOnboarding();
