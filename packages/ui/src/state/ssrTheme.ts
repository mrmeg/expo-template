import { createContext, use } from "react";
import type { ResolvedTheme, ThemePreference } from "./themeStore";

/**
 * The theme values the FIRST render must use on web — server and client alike.
 *
 * `useThemeStore` is a module singleton shared by every concurrent SSR request,
 * so a per-request theme can never be written into it. This context is the
 * per-request channel instead: the host app resolves it from the request (a
 * cookie the client mirrors) and provides it above the tree, and `useTheme`
 * reads it until the store has loaded real persistence after mount.
 */
export type SsrThemeSeed = {
  userTheme: ThemePreference;
  systemTheme: ResolvedTheme;
};

/**
 * What a first-time visitor gets: no persisted preference, light scheme. Same
 * values the store boots with, so a host app that never provides the context
 * behaves exactly as it did before the seed existed.
 */
export const SSR_THEME_SEED_DEFAULT: SsrThemeSeed = {
  userTheme: "system",
  systemTheme: "light",
};

/**
 * Per-request theme seed consumed by `useTheme`/`useStyles` while
 * `hasLoadedTheme` is false (i.e. on the server render and the client's first
 * render, before `syncThemeFromEnvironment()` reads real persistence).
 *
 * Provide it near the top of the tree from a value BOTH the server and the
 * browser can derive from the same bytes — a cookie. Reading `localStorage`
 * for this would reintroduce the hydration mismatch it exists to remove,
 * because the server cannot see `localStorage`.
 *
 * ```tsx
 * import { SsrThemeSeedContext } from "@mrmeg/expo-ui/state";
 *
 * <SsrThemeSeedContext.Provider value={seedFromCookie}>
 *   <App />
 * </SsrThemeSeedContext.Provider>
 * ```
 */
export const SsrThemeSeedContext = createContext<SsrThemeSeed>(SSR_THEME_SEED_DEFAULT);

/** Read the active SSR theme seed (the default when no provider is mounted). */
export function useSsrThemeSeed(): SsrThemeSeed {
  return use(SsrThemeSeedContext);
}
