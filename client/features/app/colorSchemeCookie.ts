/**
 * Mirrors the resolved color scheme into the `color-scheme` cookie that
 * `shared/ssrColorScheme.ts` reads during SSR, so the server paints the
 * visitor's theme on the first render. Web only; localStorage (the theme
 * store's own persistence) stays the source of truth.
 *
 * Two writers keep the cookie fresh: the blocking script in `app/+html.tsx`
 * (every page load, before the bundle boots) and `startColorSchemeCookieSync`
 * (every theme change or OS scheme flip while the app runs).
 */
import { useState } from "react";
import { Platform } from "react-native";
import { resolveThemePreference, useThemeStore } from "@mrmeg/expo-ui/state";
import {
  colorSchemeCookieString,
  detectColorSchemeFromRequestScope,
  parseColorSchemeCookie,
  type SsrColorScheme,
} from "@/shared/ssrColorScheme";

export function writeColorSchemeCookie(scheme: SsrColorScheme): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.cookie = colorSchemeCookieString(scheme);
}

/**
 * Subscribes to the theme store and rewrites the cookie whenever the resolved
 * scheme changes. Returns the unsubscribe; call from a root `useEffect`.
 */
export function startColorSchemeCookieSync(): () => void {
  if (Platform.OS !== "web") return () => {};
  let last: SsrColorScheme | undefined;
  const sync = (state: { userTheme: "system" | "light" | "dark"; systemTheme: "light" | "dark"; hasLoadedTheme: boolean }) => {
    // Until the preference is read the store holds its boot default, which is
    // not the visitor's scheme; the +html script already wrote the right one.
    if (!state.hasLoadedTheme) return;
    const scheme = resolveThemePreference(state.userTheme, state.systemTheme);
    if (scheme === last) return;
    last = scheme;
    writeColorSchemeCookie(scheme);
  };
  sync(useThemeStore.getState());
  return useThemeStore.subscribe(sync);
}

/**
 * The scheme the FIRST render must use on web — server and client alike: the
 * server reads the cookie off Expo Server's request scope, the browser off
 * `document.cookie`, the same bytes, so the hydrated tree matches the HTML.
 * `undefined` (no cookie yet, native) leaves the kit's default in place.
 */
export function readColorSchemeCookie(): SsrColorScheme | undefined {
  if (Platform.OS !== "web") return undefined;
  if (typeof document !== "undefined") return parseColorSchemeCookie(document.cookie);
  return detectColorSchemeFromRequestScope();
}

/**
 * Lazy state, like the SSR viewport metrics: resolved once per mount during
 * render and never recomputed into a mismatch; a module-scope value would leak
 * one request's scheme into another's render.
 */
export function useSsrColorScheme(): SsrColorScheme | undefined {
  const [scheme] = useState(readColorSchemeCookie);
  return scheme;
}
