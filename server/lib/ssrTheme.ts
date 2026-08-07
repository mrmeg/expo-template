// SSR theme detection. Companion to `ssrOnboarding.ts`: the server can't read
// `localStorage`, so without a signal in the request every SSR render emits a
// fully LIGHT-themed React tree — a dark-mode visitor sees the whole page
// re-color after hydration. `@mrmeg/expo-ui`'s theme store mirrors the
// persisted preference into a `user-theme-preference` cookie purely so this
// module can read it back during SSR.
//
// localStorage / AsyncStorage stays the client's source of truth. The cookie is
// a server-render hint only, and `syncThemeFromEnvironment()` reconciles
// against real persistence after mount, so a stale cookie can never pin a user
// to the wrong theme beyond the first paint.
//
// Two read surfaces, mirroring ssrOnboarding.ts:
//
//   1. `detectSsrThemeSeedFromRequestScope()` — reads Expo Server's ambient
//      request scope. This is what the app uses, because the theme provider
//      lives in the ROOT LAYOUT and layouts cannot export loaders
//      (`@expo/router-server`'s server manifest only carries leaf html
//      routes), so there is no loader to hang the value off.
//
//   2. `detectSsrThemeSeed(request)` — the explicit, loader-friendly form,
//      matching `detectSsrViewportWidth(request)` and
//      `detectOnboardingSeen(request)`.
//
// `system` resolution uses the `Sec-CH-Prefers-Color-Scheme` client hint when
// the browser sends it. Browsers only send it after the document has asked,
// which is what `THEME_CLIENT_HINT_ACCEPT_CH` is for — `app/+html.tsx` emits
// it as `<meta http-equiv="Accept-CH">` so the opt-in lives in one place
// instead of being duplicated across both server entries (and it survives a
// static export). The hint therefore arrives from the second navigation
// onwards, and only on browsers that implement client hints.

import { requestHeaders } from "expo-server";

import type { ResolvedTheme, ThemePreference } from "@mrmeg/expo-ui/state";
import {
  SSR_THEME_SEED_DEFAULT,
  resolveThemePreference,
  type SsrThemeSeed,
} from "@mrmeg/expo-ui/state";

const COOKIE_NAME = "user-theme-preference";

// Anchored to a cookie boundary so `not-user-theme-preference=dark` can't match.
const COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`);

const CLIENT_HINT_HEADER = "sec-ch-prefers-color-scheme";

export const THEME_COOKIE_NAME = COOKIE_NAME;
export const THEME_CLIENT_HINT_HEADER = CLIENT_HINT_HEADER;

/**
 * The client hint to request. `app/+html.tsx` emits this as
 * `<meta http-equiv="Accept-CH" content="…">`, which is the document-level
 * equivalent of the `Accept-CH` response header — one place to declare it, and
 * it works for both server entries and a static export.
 */
export const THEME_CLIENT_HINT_ACCEPT_CH = "Sec-CH-Prefers-Color-Scheme";

/**
 * `<html>` attribute the server stamps with the scheme it resolved for a
 * `system` visitor.
 *
 * The client hint is a *request* header, so the browser's JS can't read it.
 * Without this attribute the client's first render would have to guess the
 * system scheme (`window.matchMedia`) and would disagree with the server
 * whenever no hint was sent — a hydration mismatch. Writing the resolved value
 * into the served HTML makes both sides read the same byte.
 */
export const SSR_SYSTEM_SCHEME_ATTRIBUTE = "data-ssr-system-scheme";

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Parse a raw `Cookie` header (or `document.cookie`) for the persisted theme
 * preference. Returns `null` when the cookie is absent, empty, or carries a
 * value the store would never write — an unknown value must not be trusted as
 * a preference.
 *
 * Shared by the server read and the client's first-render read so both sides
 * derive the same preference from the same bytes; that identity is what keeps
 * hydration clean.
 */
export function parseThemePreferenceCookie(
  cookieHeader: string | null | undefined
): ThemePreference | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(COOKIE_PATTERN);
  if (!match) return null;
  const value = match[1].trim();
  return isThemePreference(value) ? value : null;
}

/**
 * Parse the `Sec-CH-Prefers-Color-Scheme` client hint. Only `light` and `dark`
 * are valid values; anything else (including a missing header) is `null`.
 */
export function parseColorSchemeClientHint(
  hint: string | null | undefined
): ResolvedTheme | null {
  if (!hint) return null;
  const value = hint.trim().toLowerCase();
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  return null;
}

/**
 * Build the seed `@mrmeg/expo-ui`'s `SsrThemeSeedContext` expects from raw
 * header values.
 *
 * `systemTheme` resolves from the client hint when present and otherwise falls
 * back to light — the server genuinely cannot know the OS preference on a
 * first visit with no hint, and light is the value the store has always booted
 * with. An explicit `light`/`dark` preference makes `systemTheme` irrelevant
 * (`resolveThemePreference` ignores it), but it is still filled in so a
 * post-mount switch to `system` has a sane starting point.
 */
export function resolveSsrThemeSeed(
  cookieHeader: string | null | undefined,
  colorSchemeHint?: string | null
): SsrThemeSeed {
  const userTheme = parseThemePreferenceCookie(cookieHeader);
  const systemTheme = parseColorSchemeClientHint(colorSchemeHint);

  if (!userTheme && !systemTheme) {
    // No signal at all: hand back the shared default object so consumers can
    // compare by reference and skip provider work entirely.
    return SSR_THEME_SEED_DEFAULT;
  }

  return {
    userTheme: userTheme ?? SSR_THEME_SEED_DEFAULT.userTheme,
    systemTheme: systemTheme ?? SSR_THEME_SEED_DEFAULT.systemTheme,
  };
}

/**
 * Detect the theme seed from an explicit request object. Suitable for use
 * directly inside a route loader.
 */
export function detectSsrThemeSeed(request: HeaderSource): SsrThemeSeed {
  if (!request) return SSR_THEME_SEED_DEFAULT;
  return resolveSsrThemeSeed(
    request.headers.get("cookie"),
    request.headers.get(CLIENT_HINT_HEADER)
  );
}

/**
 * Detect the theme seed from Expo Server's ambient request scope.
 *
 * The try/catch is mandatory, not defensive politeness: this module is
 * reachable from the client bundle (the root layout imports it), and
 * `requestHeaders()` throws whenever there is no active request scope — in the
 * browser, during static export, and in unit tests. Every one of those cases
 * must resolve to the default seed, which is also the correct answer for a
 * visitor with no cookie.
 */
export function detectSsrThemeSeedFromRequestScope(): SsrThemeSeed {
  try {
    const headers = requestHeaders();
    return resolveSsrThemeSeed(headers.get("cookie"), headers.get(CLIENT_HINT_HEADER));
  } catch {
    return SSR_THEME_SEED_DEFAULT;
  }
}

/**
 * The scheme a seed resolves to — i.e. what the server render will paint.
 *
 * Thin re-export of the package's `resolveThemePreference` so `app/+html.tsx`
 * (which needs the scheme for `data-theme` and the body background) doesn't
 * have to re-derive the precedence rule.
 */
export function resolveSsrScheme(seed: SsrThemeSeed): ResolvedTheme {
  return resolveThemePreference(seed.userTheme, seed.systemTheme);
}
