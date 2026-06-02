import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "has-seen-onboarding";

export type OnboardingStore = {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
  loadOnboarding: () => Promise<void>;
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
      return AsyncStorage.getItem(ONBOARDING_KEY)
        .then((saved) => {
          if (saved !== null) {
            set({ hasSeenOnboarding: JSON.parse(saved) });
          }
        })
        .catch(() => {});
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      if (saved !== null) {
        set({ hasSeenOnboarding: JSON.parse(saved) });
      }
    }
    return Promise.resolve();
  },
}));

// Native has no SSR, so eagerly hydrate from storage on store creation. On web
// the read is deferred to a useEffect (see useAppStartup) so the first client
// render matches the server's `hasSeenOnboarding: false` — otherwise the gate
// the server rendered and the Stack the client renders disagree, producing both
// a hydration mismatch and a returning-user onboarding flash. Mirrors the
// themeStore web/native split.
if (Platform.OS !== "web") {
  useOnboardingStore.getState().loadOnboarding();
}
