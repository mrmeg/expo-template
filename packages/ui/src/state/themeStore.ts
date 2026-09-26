import { Appearance, Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ThemeColors } from "../constants/colors";
import type { FontOverrides } from "../constants/fonts";

const THEME_KEY = "user-theme-preference";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Key the persisted preference lives under (`localStorage` on web,
 * `AsyncStorage` on native). Exported so a host app's pre-boot script — e.g.
 * the blocking color-scheme script in `app/+html.tsx` — can read the same
 * value the store does.
 */
export const THEME_STORAGE_KEY = THEME_KEY;

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
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

/** A radius override for one shape slot. `0` is square corners; `9999` is a pill. */
export type ShapeSlotOverride = {
  /** Border radius for every component in the slot. A caller `style` still wins. */
  borderRadius?: number;
};

/**
 * Shape overrides a host app can inject, grouped per slot. Every field is
 * optional; omitted fields keep the package default. Components read their
 * slot through `useShape(slot)` and layer it after the static radius, before
 * the caller's `style`.
 *
 * | Slot | Components | Package default |
 * |---|---|---|
 * | `button` | Button (every preset) | `spacing.radiusMd` (10) |
 * | `input` | TextInput (not `underlined`), Select trigger, InputOTP cells | `spacing.radiusMd` (10) |
 * | `card` | Card, StatCard, EmptyState (`bordered`), SkeletonCard | `spacing.radiusLg` (14) |
 * | `sheet` | BottomSheet top corners (where the platform lets the sheet draw them: web, Android) | platform |
 * | `badge` | Badge | `spacing.radiusFull` |
 * | `dialog` | Dialog and AlertDialog content | `spacing.radiusLg` (14) |
 */
export type ShapeOverrides = {
  button?: ShapeSlotOverride & {
    /**
     * Whether the `default` preset renders its shadow. Package default: true.
     * Other presets stay flat regardless; the per-instance `withShadow` prop
     * still wins over this.
     */
    withShadow?: boolean;
  };
  input?: ShapeSlotOverride;
  card?: ShapeSlotOverride;
  sheet?: ShapeSlotOverride;
  badge?: ShapeSlotOverride;
  dialog?: ShapeSlotOverride;
};

export type ShapeSlot = keyof ShapeOverrides;

export type ThemeStore = {
  userTheme: ThemePreference;
  systemTheme: ResolvedTheme;
  /**
   * True once the persisted preference has actually been read (or explicitly
   * set by the user). Until then `userTheme` / `systemTheme` still hold the
   * boot defaults ("system" / light), so a host app that needs to hold a
   * paint until the real preference is known can wait on this. Mirrors
   * `hasLoadedOnboarding` in the host app's onboarding store.
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
   * App-injected shape overrides (radii per slot, the default Button preset's
   * shadow). Same contract as the other override slots: empty by default,
   * fully backward compatible when unset.
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
   * to the package defaults (see the slot table on `ShapeOverrides`: button
   * and input radius 10 = `spacing.radiusMd`, card and dialog 14 =
   * `spacing.radiusLg`, badge pill, default-preset shadow on).
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
  // Always start with "light" so a web app's first render matches the HTML
  // shell that was rendered in Node at export time (no `window`, no storage).
  // Real values arrive from `syncThemeFromEnvironment()` after mount; a host
  // app's pre-boot script paints the correct background in the meantime.
  systemTheme: "light",

  // False until persistence has been read.
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
      }
    }
    set({ hasLoadedTheme: true });
  }
}));

// The OS color-scheme listener is shared: one subscription however many
// callers hold it, removed when the last holder releases. Each
// `startSystemThemeListener()` call takes a hold and gets its own release.
let systemThemeSubscription: { remove: () => void } | null = null;
let systemThemeHolds = 0;

export function syncSystemTheme(): void {
  useThemeStore.getState().setSystemTheme(getSystemTheme());
}

function subscribeToSystemTheme(): { remove: () => void } {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      useThemeStore.getState().setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return { remove: () => mediaQuery.removeEventListener("change", onChange) };
    }
    mediaQuery.addListener(onChange);
    return { remove: () => mediaQuery.removeListener(onChange) };
  }

  return Appearance.addChangeListener(({ colorScheme }) => {
    useThemeStore.getState().setSystemTheme(colorScheme === "dark" ? "dark" : "light");
  });
}

/**
 * Keep `systemTheme` following the OS color scheme (`prefers-color-scheme` on
 * web, `Appearance` on native). The first holder reads the current scheme and
 * attaches the one listener; later calls share it.
 *
 * Returns this caller's release: once every holder has released, the
 * listener is removed. Calling a release again is a no-op, so an effect
 * cleanup that runs twice can't drop another caller's hold. On native the
 * package holds the listener for the app's lifetime (see the module-load
 * init below), so an app's release never stops OS tracking there.
 */
export function startSystemThemeListener(): () => void {
  systemThemeHolds += 1;
  if (systemThemeHolds === 1) {
    syncSystemTheme();
    systemThemeSubscription = subscribeToSystemTheme();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    systemThemeHolds -= 1;
    if (systemThemeHolds === 0) {
      systemThemeSubscription?.remove();
      systemThemeSubscription = null;
    }
  };
}

/**
 * Single entry point for host apps to populate the store from the
 * environment: the OS color-scheme listener plus the persisted preference.
 *
 * Web apps call it once, from a top-level `useEffect` (never during render or
 * at module scope — see below), and return its result as the cleanup:
 * `useEffect(() => syncThemeFromEnvironment(), [])`. Safe to call more than
 * once (StrictMode's double effects, two roots): every call shares the one
 * OS listener, re-reads the persisted preference, and returns its own
 * cleanup, which releases only that call's hold on the listener.
 *
 * The listener starts BEFORE `loadTheme()` on purpose: reading the real OS
 * scheme first means a `system` user resolves straight from the boot-default
 * "light" to their actual scheme in one commit.
 */
export function syncThemeFromEnvironment(): () => void {
  const release = startSystemThemeListener();
  useThemeStore.getState().loadTheme();
  return release;
}

// Native can read persistence at module load, so keep the historical
// auto-init behavior there, with a hold on the OS listener that is never
// released. On web the host app must call `syncThemeFromEnvironment()` from a
// top-level `useEffect`: web bundles are also evaluated in Node when
// `expo export` renders the HTML shell, where `window`/`localStorage` don't
// exist, and reading them during the browser's first render would disagree
// with the markup being hydrated.
if (Platform.OS !== "web") {
  useThemeStore.getState().loadTheme();
  startSystemThemeListener();
}
