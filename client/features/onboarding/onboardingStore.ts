import { useState } from "react";
import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ONBOARDING_SEEN_COOKIE_NAME,
  ONBOARDING_SEEN_COOKIE_VALUE,
  detectOnboardingSeenFromRequestScope,
  parseOnboardingSeenCookie,
} from "@/server/lib/ssrOnboarding";

const ONBOARDING_KEY = "has-seen-onboarding";

// Mirror of the persisted flag, written on web only so the SSR server can tell
// returning visitors apart from new ones. See server/lib/ssrOnboarding.ts.
// localStorage remains the source of truth; the cookie is a render hint the
// client reconciles away after mount.
const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeOnboardingSeenCookie(seen: boolean): void {
  if (typeof document === "undefined") return;
  // max-age=0 expires the cookie so an onboarding reset stops server-rendering
  // the app shell for a user who should see the gate again.
  const maxAge = seen ? ONBOARDING_COOKIE_MAX_AGE : 0;
  const value = seen ? ONBOARDING_SEEN_COOKIE_VALUE : "";
  document.cookie = `${ONBOARDING_SEEN_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * The value the FIRST render must use on web — server and client alike.
 *
 * Both sides read the same cookie bytes: the server from the ambient Expo
 * Server request scope, the browser from `document.cookie`. Identical input on
 * both sides is what makes the hydrated tree match the server HTML. Never read
 * `localStorage` here — the server can't see it, and that asymmetry is exactly
 * the hydration mismatch this replaces.
 */
function readOnboardingSeenCookie(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof document !== "undefined") return parseOnboardingSeenCookie(document.cookie);
  return detectOnboardingSeenFromRequestScope();
}

export type OnboardingStore = {
  hasSeenOnboarding: boolean;
  /**
   * True once `loadOnboarding()` has finished reading persistence. Until then,
   * web renders trust the cookie hint (see `useHasSeenOnboarding`) because
   * `hasSeenOnboarding` still holds its pre-read default.
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
    // Dual-write: localStorage for the client, cookie for the next SSR render.
    writeOnboardingSeenCookie(seen);
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
        const seen = JSON.parse(saved);
        set({ hasSeenOnboarding: seen });
        // Repair a cookie that drifted from localStorage (cleared cookies,
        // a visitor who onboarded before this mechanism existed) so the very
        // next SSR render is already correct.
        writeOnboardingSeenCookie(seen);
      } else {
        // Nothing persisted but a cookie says "seen" — the cookie is stale
        // (site data cleared). localStorage wins: drop the cookie and let the
        // gate render.
        writeOnboardingSeenCookie(false);
      }
    }
    set({ hasLoadedOnboarding: true });
    return Promise.resolve();
  },
}));

/**
 * The onboarding flag as the render tree should see it.
 *
 * Native returns store state directly — it hydrates from AsyncStorage at module
 * load and has no SSR to agree with.
 *
 * Web is the interesting case, and it follows the `useDimensions` shape
 * (packages/ui/src/hooks/useDimensions.ts): a lazy `useState` initializer seeds
 * the first render from the cookie — the one signal the server and the browser
 * both have — so SSR HTML and the hydrated tree agree. After mount,
 * `loadOnboarding()` (driven by `useAppStartup`) reads localStorage and flips
 * `hasLoadedOnboarding`, at which point store state takes over. localStorage
 * therefore always wins on a mismatch, so a stale cookie can't trap a user in
 * the wrong shell for more than the first paint.
 */
export function useHasSeenOnboarding(): boolean {
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const hasLoadedOnboarding = useOnboardingStore((s) => s.hasLoadedOnboarding);

  // Lazy initializer: evaluated once per mount, during render, on both the
  // server and the client. Must NOT be recomputed later or the reconcile below
  // could be overwritten by a stale cookie.
  const [cookieSeen] = useState(readOnboardingSeenCookie);

  if (Platform.OS !== "web") return hasSeenOnboarding;
  return hasLoadedOnboarding ? hasSeenOnboarding : cookieSeen;
}

// Native has no SSR, so eagerly hydrate from storage on store creation. On web
// the read is deferred to a useEffect (see useAppStartup) so the first client
// render matches the server — which now means matching the cookie-derived value
// that `useHasSeenOnboarding` seeds on both sides, not a hardcoded `false`.
// Reading localStorage during render instead would reintroduce the mismatch,
// because the server cannot see it. Mirrors the themeStore web/native split.
if (Platform.OS !== "web") {
  useOnboardingStore.getState().loadOnboarding();
}
