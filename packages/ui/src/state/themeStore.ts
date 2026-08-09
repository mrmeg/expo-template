import { Appearance, Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ThemeColors } from "../constants/colors";
import type { FontOverrides } from "../constants/fonts";

const THEME_KEY = "user-theme-preference";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Cookie name the web build mirrors the persisted preference into, so a
 * server-rendered host can seed its first render with the visitor's real
 * theme instead of shipping a light tree that recolors after hydration.
 *
 * Same name as the `localStorage` key on purpose: one string to grep, and the
 * blocking color-scheme script in a host's `+html.tsx` already reads it.
 * `localStorage` stays the source of truth; the cookie is a render hint only.
 */
export const THEME_COOKIE_NAME = THEME_KEY;
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function writeThemeCookie(theme: ThemePreference): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.cookie =
    `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

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

/**
 * Shape overrides a host app can inject, grouped per component so future
 * shape knobs (card radius, input radius, …) slot in without reshaping the
 * API. Every field is optional; omitted fields keep the package default.
 */
export type ShapeOverrides = {
  button?: {
    /**
     * Border radius applied to every Button preset. Package default:
     * `spacing.radiusMd` (12). Use 9999 for pill buttons. A caller `style`
     * still wins over this, as it always has.
     */
    borderRadius?: number;
    /**
     * Whether the `default` preset renders its shadow. Package default: true.
     * Other presets stay flat regardless; the per-instance `withShadow` prop
     * still wins over this.
     */
    withShadow?: boolean;
  };
};

export type ThemeStore = {
  userTheme: ThemePreference;
  systemTheme: ResolvedTheme;
  /**
   * True once the persisted preference has actually been read (or explicitly
   * set by the user). Until then, a web render must not trust `userTheme` /
   * `systemTheme` — they still hold the SSR-safe boot defaults, and `useTheme`
   * uses `SsrThemeSeedContext` (cookie-derived, identical on server and
   * client) instead. Mirrors `hasLoadedOnboarding` in the host app's
   * onboarding store.
   */
  hasLoadedTheme: boolean;
  /**
   * App-injected palette overrides, applied by `useTheme` on top of the
   * package defaults. Empty by default — zero override means the package
   * behaves exactly as before this field existed (fully backward compatible).
   */
  colorOverrides: ColorOverrides;
  /**
   * App-injected font overrides, applied by `StyledText` on top of the package
   * defaults. Empty by default — zero override means the package behaves
   * exactly as before this field existed (fully backward compatible).
   */
  fontOverrides: FontOverrides;
  /**
   * App-injected shape overrides (button radius, default-preset shadow).
   * Same contract as the other override slots: empty by default, fully
   * backward compatible when unset.
   */
  shapeOverrides: ShapeOverrides;
  setTheme: (theme: ThemePreference) => void;
  setSystemTheme: (theme: ResolvedTheme) => void;
  /**
   * Replace the active color overrides. Pass `{}` (or omit both schemes) to
   * clear overrides and fall back to the package defaults.
   */
  setColors: (overrides: ColorOverrides) => void;
  /**
   * Replace the active font overrides. Pass `{}` to clear them and fall back
   * to the package's bundled faces.
   *
   * Call this once at startup, after the app's fonts have been registered
   * (e.g. alongside `setColors` in a theme-sync component). Apps loading
   * per-weight faces via `expo-font` should also pass
   * `webWeightStrategy: "family"` — see `FontWeightStrategy`.
   */
  setFonts: (overrides: FontOverrides) => void;
  /**
   * Replace the active shape overrides. Pass `{}` to clear them and fall back
   * to the package defaults (button radius 12, default-preset shadow on).
   */
  setShape: (overrides: ShapeOverrides) => void;
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
  // Real values are populated by `syncThemeFromEnvironment()` after mount;
  // until then a web render reads `SsrThemeSeedContext` (cookie-derived) so
  // the server and the browser paint the visitor's actual theme.
  systemTheme: "light",

  // False until persistence has been read. `useTheme` uses this to decide
  // whether to trust store state or the per-request SSR seed.
  hasLoadedTheme: false,

  // No overrides by default: the package renders with its built-in palette
  // until a host app calls `setColors`.
  colorOverrides: {},

  // Same contract as `colorOverrides`: the package renders with its bundled
  // faces until a host app calls `setFonts`.
  fontOverrides: {},

  // And again for shape: package geometry until a host app calls `setShape`.
  shapeOverrides: {},

  setColors: (overrides) => {
    set({ colorOverrides: overrides ?? {} });
  },

  setFonts: (overrides) => {
    set({ fontOverrides: overrides ?? {} });
  },

  setShape: (overrides) => {
    set({ shapeOverrides: overrides ?? {} });
  },

  setTheme: (theme) => {
    set({
      userTheme: theme,
      hasLoadedTheme: true,
      ...(theme === "system" ? { systemTheme: getSystemTheme() } : {}),
    });
    // Save directly when setting theme
    if (Platform.OS !== "web") {
      AsyncStorage.setItem(THEME_KEY, theme).catch(() => {
        // Silently fail if storage is not available
      });
      return;
    }
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(THEME_KEY, theme);
    }
    // Dual-write: localStorage for the client, cookie for the next SSR render
    // (so the server paints the right theme on the visitor's next request).
    writeThemeCookie(theme);
  },

  setSystemTheme: (theme) => {
    set({ systemTheme: theme });
  },

  loadTheme: () => {
    if (Platform.OS !== "web") {
      AsyncStorage.getItem(THEME_KEY).then((saved) => {
        if (saved && isThemePreference(saved)) {
          set({ userTheme: saved });
        }
      }).catch(() => {
        // Use default if loading fails
      }).finally(() => {
        set({ hasLoadedTheme: true });
      });
      return;
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && isThemePreference(saved)) {
        set({ userTheme: saved });
        // Backfill / repair the cookie so a visitor who set their preference
        // before this mechanism existed (or who cleared cookies) gets a
        // correctly themed server render on their very next request.
        writeThemeCookie(saved);
      } else {
        // Nothing persisted: mirror the implicit "system" default so the
        // server stops guessing from a stale cookie.
        writeThemeCookie("system");
      }
    }
    set({ hasLoadedTheme: true });
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
//
// The listener starts BEFORE `loadTheme()` on purpose: `loadTheme` is what
// flips `hasLoadedTheme`, which is the moment web renders stop trusting the
// SSR seed and start trusting store state. Reading the real OS scheme first
// means a `system` user never sees a frame of the boot-default "light".
export function syncThemeFromEnvironment(): () => void {
  const stop = startSystemThemeListener();
  useThemeStore.getState().loadTheme();
  return stop;
}

// Native has no SSR mismatch concern, so keep the historical auto-init
// behavior there. On web the host app must call `syncThemeFromEnvironment()`
// from a top-level `useEffect` to avoid hydration mismatches.
if (Platform.OS !== "web") {
  useThemeStore.getState().loadTheme();
  startSystemThemeListener();
}
