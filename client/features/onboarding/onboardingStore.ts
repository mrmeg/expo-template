import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "has-seen-onboarding";

export type OnboardingStore = {
  hasSeenOnboarding: boolean;
  /**
   * True once `loadOnboarding()` has finished reading persistence. Until then
   * `hasSeenOnboarding` still holds its pre-read default (`false`), so a
   * returning web visitor sees the gate for the frames between the first
   * commit and the storage read.
   */
  hasLoadedOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
  loadOnboarding: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  hasSeenOnboarding: false,
  hasLoadedOnboarding: false,

  setHasSeenOnboarding: (seen) => {
    set({ hasSeenOnboarding: seen, hasLoadedOnboarding: true });
    if (Platform.OS !== "web") {
      AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(seen)).catch(() => {});
      return;
    }
    if (typeof window !== "undefined" && window.localStorage) {
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
        .catch(() => {})
        .finally(() => {
          set({ hasLoadedOnboarding: true });
        });
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      if (saved !== null) {
        set({ hasSeenOnboarding: JSON.parse(saved) });
      }
    }
    set({ hasLoadedOnboarding: true });
    return Promise.resolve();
  },
}));

/**
 * The onboarding flag as the render tree should see it.
 *
 * Store state on every platform. Native hydrates from AsyncStorage at module
 * load; web defers the localStorage read to `loadOnboarding()` (driven by
 * `useAppStartup`), so a returning visitor sees the gate until that resolves.
 * localStorage is the only source of truth.
 */
export function useHasSeenOnboarding(): boolean {
  return useOnboardingStore((s) => s.hasSeenOnboarding);
}

// Native can read persistence at module load, so hydrate eagerly there. On web
// the read is deferred to a useEffect (see useAppStartup): web bundles are also
// evaluated in Node when `expo export` renders the HTML shell, where
// `localStorage` doesn't exist, and reading it during the browser's first
// render would disagree with the markup being hydrated. Mirrors the themeStore
// web/native split.
if (Platform.OS !== "web") {
  useOnboardingStore.getState().loadOnboarding();
}
