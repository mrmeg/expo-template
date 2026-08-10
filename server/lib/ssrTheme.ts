// SSR theme detection. Companion to `ssrOnboarding.ts`: the server can't read
// `localStorage`, so without a signal in the request every SSR render emits a
// fully LIGHT-themed React tree — a dark-mode visitor sees the whole page
// re-color after hydration. `@mrmeg/expo-ui`'s theme store mirrors two values
// into cookies purely so this module can read them back during SSR:
// `user-theme-preference` (the preference) and `system-color-scheme` (the OS
// scheme the browser last resolved).
//
// localStorage / AsyncStorage stays the client's source of truth. The cookies
// are server-render hints only, and `syncThemeFromEnvironment()` reconciles
// against real persistence and the live `matchMedia` after mount, so a stale
// cookie can never pin a user to the wrong theme beyond the first paint.
//
// Two read surfaces, mirroring ssrOnboarding.ts:
//
//   1. `detectSsrThemeFromRequestScope()` — reads Expo Server's ambient
//      request scope. This is what the app uses, because the theme provider
//      lives in the ROOT LAYOUT and layouts cannot export loaders
//      (`@expo/router-server`'s server manifest only carries leaf html
//      routes), so there is no loader to hang the value off.
//
//   2. `detectSsrTheme(request)` — the explicit, loader-friendly form, matching
//      `detectSsrViewportWidth(request)` and `detectOnboardingSeen(request)`.
//
// Each has a `…Seed` variant that returns just the seed, for callers (the
// provider) that render the same thing whether or not a signal was present.
//
// IMPORTANT: absence of a signal is itself information. A detection with
// `hasSignal: false` means the server is GUESSING light, and `app/+html.tsx`
// must then leave `data-theme` off `<html>` so the inline color-scheme script
// and the `prefers-color-scheme` CSS fallback stay live for a hint-less
// dark-OS first-timer. Stamping a guess disables both.
//
// `system` resolution has two channels, in this precedence:
//
//   1. The `Sec-CH-Prefers-Color-Scheme` client hint. Same-request and
//      therefore the freshest possible reading, but Chromium-only, and only
//      from the second navigation onwards: browsers send it after the document
//      has asked, which is what `THEME_CLIENT_HINT_ACCEPT_CH` is for —
//      `app/+html.tsx` emits it as `<meta http-equiv="Accept-CH">` so the
//      opt-in lives in one place instead of being duplicated across both
//      server entries (and it survives a static export).
//
//   2. The `system-color-scheme` cookie, written by the store from the
//      browser's own `matchMedia` result. Works on every browser, but it
//      reports the PREVIOUS load's scheme, so it can be stale (the visitor
//      flipped their OS theme between visits). That staleness is why the
//      inline script in `app/+html.tsx` re-checks a cookie-derived stamp
//      against `matchMedia` instead of bailing out on sight of `data-theme`.
//
// Without the cookie, `system` — the default preference, which most visitors
// never change — was unresolvable on Safari and Firefox entirely, so those
// visitors got a light server render on every single load.

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

// Duplicated literal, deliberately: `packages/ui` cannot import from `server/`
// (and vice versa), so the store and this module each declare the name and a
// test pins them equal. Same arrangement as COOKIE_NAME above.
const SYSTEM_SCHEME_COOKIE = "system-color-scheme";
const SYSTEM_SCHEME_COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${SYSTEM_SCHEME_COOKIE}=([^;]*)`);

const CLIENT_HINT_HEADER = "sec-ch-prefers-color-scheme";

export const THEME_COOKIE_NAME = COOKIE_NAME;

/**
 * Cookie carrying the OS color scheme the browser last resolved (`light` /
 * `dark`). Written by `@mrmeg/expo-ui`'s theme store on web.
 *
 * `app/+html.tsx` needs the name too — its blocking script re-reads this cookie
 * to decide whether a `data-theme` stamp derived from it has gone stale.
 */
export const SYSTEM_SCHEME_COOKIE_NAME = SYSTEM_SCHEME_COOKIE;
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
 *
 * This stays the ONLY channel for the client seed even though the
 * `system-color-scheme` cookie is readable from browser JS: the cookie may have
 * LOST to a fresher same-request hint on the server, so a client that read the
 * cookie directly would reintroduce exactly the mismatch this attribute exists
 * to prevent. Whatever the server resolved is what the attribute says, and the
 * attribute is what the client reads.
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
 * Parse the `system-color-scheme` cookie — the OS scheme the browser resolved on
 * the visitor's previous load.
 *
 * Only `light`/`dark` count. `system` is not a valid value here (it's a
 * *resolved* scheme, not a preference) and neither is anything else the store
 * would never write, because this value can end up stamped on `<html>` and must
 * not be able to carry junk into the CSS selectors.
 *
 * Same anchored-boundary matching as {@link parseThemePreferenceCookie} so a
 * cookie merely *ending* in `system-color-scheme` can't spoof it.
 */
export function parseSystemSchemeCookie(
  cookieHeader: string | null | undefined
): ResolvedTheme | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(SYSTEM_SCHEME_COOKIE_PATTERN);
  if (!match) return null;
  const value = match[1].trim();
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  return null;
}

/**
 * What the request told us about the visitor's theme.
 *
 * `seed` is always renderable — it falls back to the same values the store
 * boots with — but callers that write to the DOM need to know whether those
 * values came from the visitor or from that fallback, so `hasSignal` reports it
 * and `scheme` is `null` in the fallback case.
 *
 * `app/+html.tsx` is the caller that cares. Stamping `data-theme` on a *guess*
 * would be actively harmful: it kills the `@media (prefers-color-scheme: dark)
 * html:not([data-theme])` CSS fallback outright, and it leaves the
 * `COLOR_SCHEME_SCRIPT` with nothing to correct against (that script only
 * restamps a stamp it can prove stale from the `system-color-scheme` cookie; a
 * guessed stamp has no cookie behind it). A hint-less first-time visitor on a
 * dark OS would then get a guessed-light paint with both of its safety nets
 * disabled. So: stamp only what we actually know.
 */
export type SsrThemeDetection = {
  /** The per-request seed for `SsrThemeSeedContext`. Always safe to render. */
  seed: SsrThemeSeed;
  /**
   * True when the request carried a theme signal at all — a
   * `user-theme-preference` cookie, a `system-color-scheme` cookie, a
   * `Sec-CH-Prefers-Color-Scheme` hint, or any combination. False means every
   * value in `seed` is the SSR-safe default, so there is nothing worth writing
   * into the served HTML.
   */
  hasSignal: boolean;
  /**
   * The resolved scheme when the server actually KNOWS it, and `null` when the
   * value it rendered with was a fallback guess.
   *
   * Known means: an explicit `light`/`dark` preference cookie, a real
   * `Sec-CH-Prefers-Color-Scheme` hint, or a `system-color-scheme` cookie
   * carrying the scheme the browser resolved last time. It is `null` only when
   * the preference is (or defaults to) `system` and NEITHER scheme channel said
   * anything — there the light it resolves to is a guess, and stamping a guess
   * would silence the very failsafes that can get it right.
   *
   * `null` is therefore the instruction to leave `data-theme` and
   * `color-scheme` off `<html>` so the inline script and the CSS media-query
   * fallback keep owning the case, exactly as they did before the cookies.
   *
   * A cookie-derived value is *known* but not necessarily *current*: it is the
   * previous load's reading, so a visitor who flipped their OS theme between
   * visits gets a stale stamp. `app/+html.tsx`'s inline script re-checks
   * exactly that case against `matchMedia` — see the restamp block there.
   */
  scheme: ResolvedTheme | null;
};

/** The no-signal answer: default seed, nothing to stamp. */
export const SSR_THEME_DETECTION_DEFAULT: SsrThemeDetection = {
  seed: SSR_THEME_SEED_DEFAULT,
  hasSignal: false,
  scheme: null,
};

/**
 * Resolve the detection from raw header values.
 *
 * `systemTheme` precedence: the `Sec-CH-Prefers-Color-Scheme` client hint, then
 * the `system-color-scheme` cookie, then light. The hint wins because it is a
 * same-request reading while the cookie is the previous load's; when both are
 * present and disagree, the OS scheme changed since that load and the hint is
 * the correct answer. Light remains the last resort — a literal first visit on a
 * browser that sends no hint, where the server genuinely cannot know, and light
 * is the value the store has always booted with.
 *
 * An explicit `light`/`dark` preference makes `systemTheme` irrelevant
 * (`resolveThemePreference` ignores it), but it is still filled in so a
 * post-mount switch to `system` has a sane starting point.
 *
 * `scheme` is only filled in when that resolution rested on something real: an
 * explicit preference cookie, a hint, or the resolved-scheme cookie. `system`
 * with neither scheme channel keeps `hasSignal: true` (the preference IS known,
 * and the seed carries it so the server render and the client's cookie read
 * agree) but leaves `scheme` null, because the light it resolves to is the guess
 * — the same guess the inline script and the CSS media query can improve on in
 * the browser.
 */
export function resolveSsrThemeDetection(
  cookieHeader: string | null | undefined,
  colorSchemeHint?: string | null
): SsrThemeDetection {
  const userTheme = parseThemePreferenceCookie(cookieHeader);
  const hintedScheme = parseColorSchemeClientHint(colorSchemeHint);
  const cookieScheme = parseSystemSchemeCookie(cookieHeader);
  // Hint first: it describes THIS request, the cookie describes the last one.
  const systemTheme = hintedScheme ?? cookieScheme;

  if (!userTheme && !systemTheme) {
    // No signal at all: hand back the shared default so consumers can compare
    // by reference and skip provider work entirely.
    return SSR_THEME_DETECTION_DEFAULT;
  }

  const seed: SsrThemeSeed = {
    userTheme: userTheme ?? SSR_THEME_SEED_DEFAULT.userTheme,
    systemTheme: systemTheme ?? SSR_THEME_SEED_DEFAULT.systemTheme,
  };

  // A `system` preference needs a scheme channel — hint or cookie. With neither,
  // the scheme stays unknown even though the preference itself is known.
  const schemeIsKnown = seed.userTheme !== "system" || systemTheme !== null;

  return {
    seed,
    hasSignal: true,
    scheme: schemeIsKnown ? resolveSsrScheme(seed) : null,
  };
}

/**
 * Build the seed `@mrmeg/expo-ui`'s `SsrThemeSeedContext` expects from raw
 * header values. Seed-only view of {@link resolveSsrThemeDetection}, for the
 * provider — which renders the same seed either way and so has no branch to
 * make on `hasSignal`.
 */
export function resolveSsrThemeSeed(
  cookieHeader: string | null | undefined,
  colorSchemeHint?: string | null
): SsrThemeSeed {
  return resolveSsrThemeDetection(cookieHeader, colorSchemeHint).seed;
}

/**
 * Detect the theme from an explicit request object. Suitable for use directly
 * inside a route loader.
 */
export function detectSsrTheme(request: HeaderSource): SsrThemeDetection {
  if (!request) return SSR_THEME_DETECTION_DEFAULT;
  return resolveSsrThemeDetection(
    request.headers.get("cookie"),
    request.headers.get(CLIENT_HINT_HEADER)
  );
}

/** Seed-only view of {@link detectSsrTheme}. */
export function detectSsrThemeSeed(request: HeaderSource): SsrThemeSeed {
  return detectSsrTheme(request).seed;
}

/**
 * Detect the theme from Expo Server's ambient request scope.
 *
 * The try/catch is mandatory, not defensive politeness: this module is
 * reachable from the client bundle (the root layout imports it), and
 * `requestHeaders()` throws whenever there is no active request scope — in the
 * browser, during static export, and in unit tests. Every one of those cases
 * must resolve to the no-signal default, which is also the correct answer for a
 * visitor with no cookie.
 */
export function detectSsrThemeFromRequestScope(): SsrThemeDetection {
  try {
    const headers = requestHeaders();
    return resolveSsrThemeDetection(headers.get("cookie"), headers.get(CLIENT_HINT_HEADER));
  } catch {
    return SSR_THEME_DETECTION_DEFAULT;
  }
}

/** Seed-only view of {@link detectSsrThemeFromRequestScope}. */
export function detectSsrThemeSeedFromRequestScope(): SsrThemeSeed {
  return detectSsrThemeFromRequestScope().seed;
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
