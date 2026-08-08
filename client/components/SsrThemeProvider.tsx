import React, { useState } from "react";
import { Platform } from "react-native";
import { SSR_THEME_SEED_DEFAULT, SsrThemeSeedContext, type SsrThemeSeed } from "@mrmeg/expo-ui/state";

import {
  SSR_SYSTEM_SCHEME_ATTRIBUTE,
  detectSsrThemeSeedFromRequestScope,
  parseColorSchemeClientHint,
  parseThemePreferenceCookie,
} from "@/server/lib/ssrTheme";

/**
 * The theme values the FIRST render must use on web — server and client alike.
 *
 * Both sides derive them from bytes the *other* side also has:
 *
 *   - `userTheme` comes from the `user-theme-preference` cookie: the server
 *     reads it off Expo Server's ambient request scope, the browser off
 *     `document.cookie`. Never `localStorage` — the server can't see it, and
 *     that asymmetry is exactly the hydration mismatch this replaces.
 *   - `systemTheme` comes from the `Sec-CH-Prefers-Color-Scheme` client hint,
 *     which only the server can read. So the server writes whatever it
 *     resolved onto `<html data-ssr-system-scheme>` (see `app/+html.tsx`) and
 *     the browser reads it back out of the served HTML. Using
 *     `window.matchMedia` here instead would diverge on every request where
 *     the browser sent no hint (the server would say light, the browser dark).
 *
 * When the request carried no signal at all, `+html.tsx` stamps neither
 * attribute — deliberately, so the blocking script and the
 * `prefers-color-scheme` CSS fallback stay live for a dark-OS first-timer. This
 * read then lands on `SSR_THEME_SEED_DEFAULT`, which is the *correct* answer
 * here even on a dark OS: the server rendered light, so the first client render
 * must too. The script and the CSS own the visible paint in that window; the
 * React tree recolors when `hasLoadedTheme` flips, not before.
 *
 * After mount `syncThemeFromEnvironment()` reads real persistence and starts
 * the live OS listener, flipping `hasLoadedTheme`; from then on the store is
 * the source of truth and this seed is ignored. A stale cookie can therefore
 * never pin a user to the wrong theme beyond the first paint.
 */
function readSsrThemeSeed(): SsrThemeSeed {
  if (Platform.OS !== "web") return SSR_THEME_SEED_DEFAULT;

  // Server: the ambient request scope is the only channel — the theme provider
  // lives in the root layout, and layouts can't export loaders.
  if (typeof document === "undefined") return detectSsrThemeSeedFromRequestScope();

  const userTheme = parseThemePreferenceCookie(document.cookie);
  const systemTheme = parseColorSchemeClientHint(
    document.documentElement.getAttribute(SSR_SYSTEM_SCHEME_ATTRIBUTE)
  );

  if (!userTheme && !systemTheme) return SSR_THEME_SEED_DEFAULT;
  return {
    userTheme: userTheme ?? SSR_THEME_SEED_DEFAULT.userTheme,
    systemTheme: systemTheme ?? SSR_THEME_SEED_DEFAULT.systemTheme,
  };
}

/**
 * Seeds `@mrmeg/expo-ui`'s theme hooks with the visitor's persisted theme for
 * the server render and the client's first render, so a dark-mode user's first
 * paint is dark instead of a light tree that recolors after hydration.
 *
 * Mount it above anything that calls `useTheme()` / `useStyles()` — in this
 * template that's the outermost node of `RootLayout`. See
 * `server/lib/ssrTheme.ts` and `docs/ssr-hydration.md` §5.
 */
export function SsrThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer: evaluated once per mount, during render, on both the
  // server and the client. Must NOT be recomputed later — the post-mount
  // reconcile lives in the store (`hasLoadedTheme`), not here.
  const [seed] = useState(readSsrThemeSeed);
  return <SsrThemeSeedContext.Provider value={seed}>{children}</SsrThemeSeedContext.Provider>;
}
