// SSR viewport detection. Without it, web SSR lays the whole tree out at
// viewport width 0 — react-native-web's server-side `Dimensions.window` is
// `{width: 0, height: 0}` because `update()` early-returns with no DOM — and
// the HTML ships garbage geometry: expo-router's `Header` emits
// `max-width:-68px` (from `layout.width - 68`), centered containers collapse,
// and responsive branches all resolve to their narrowest case.
//
// Order of precedence:
//   1. `mrmeg-vw` cookie — precise width written by `useDimensions` after the
//      first client mount on a given device. Best signal, available on every
//      visit after the first.
//   2. User-Agent — coarse mobile / tablet / desktop heuristic. Used on the
//      very first visit from a device, before the cookie is set. ~85%
//      accurate; misses are corrected one frame later by `useDimensions`'s
//      post-mount snap.
//   3. Desktop default — when neither cookie nor UA gives a signal (e.g.
//      crawlers, requests with no User-Agent header).
//
// Two read surfaces:
//
//   1. `detectSsrViewportFromRequestScope()` — reads Expo Server's ambient
//      request scope. This is what the app uses, because the metrics have to
//      reach the ROOT LAYOUT (`SafeAreaProvider`'s `initialMetrics`) and
//      layouts cannot export loaders. Wiring it there covers every SSR route
//      at once instead of repeating a wrapper on every leaf route.
//
//   2. `resolveSsrViewportWidth(cookieHeader, userAgent)` — the pure core.
//      The client calls it with `document.cookie` / `navigator.userAgent` so
//      the browser's FIRST render derives the identical width from the
//      identical bytes. That identity is what keeps hydration exact; see
//      client/features/app/ssrViewportMetrics.ts.

import { requestHeaders } from "expo-server";

export const SSR_VIEWPORT = {
  MOBILE: 390,
  TABLET: 820,
  DESKTOP: 1280,
} as const;

const COOKIE_NAME = "mrmeg-vw";

// Anchored to a cookie boundary so `not-mrmeg-vw=1` can't match — the
// unanchored form would have laid the whole tree out at width 1.
const COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=(\\d+)(?:;|\\s*$)`);

// Widths outside this band are a corrupt cookie, not a real device. Falling
// through to the UA heuristic beats laying out at 0 (the bug this fixes) or at
// some absurd width that would defeat every max-width in the tree.
const MIN_PLAUSIBLE_WIDTH = 200;
const MAX_PLAUSIBLE_WIDTH = 10000;

// UA patterns ordered from most-specific to most-general.
const TABLET_UA_PATTERN = /\b(iPad|Android(?!.*Mobile)|Tablet|Tab)\b/i;
const MOBILE_UA_PATTERN = /\b(Mobi|iPhone|iPod|Android.*Mobile)\b/i;

// Aspect ratios used to derive a height from a detected width. The server has
// no way to know the real viewport height, but it must supply *something*
// self-consistent: `useDimensions` derives `orientation` from width vs height
// and layout branches on it, so a wrong-side guess flips real layout.
// Phone/tablet widths get a portrait ratio, desktop a landscape one, and the
// desktop pair reproduces @mrmeg/expo-ui's DEFAULT_VIEWPORT_HEIGHT
// (1280 → 800) so this agrees with the package default.
const PORTRAIT_HEIGHT_RATIO = 16 / 9;
const LANDSCAPE_HEIGHT_RATIO = 800 / 1280;
const PORTRAIT_MAX_WIDTH = 1024;

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

export type SsrViewport = { width: number; height: number };

export const SSR_VIEWPORT_COOKIE_NAME = COOKIE_NAME;

/**
 * Parse a raw `Cookie` header (or `document.cookie`) for the persisted
 * viewport width. Shared by the server read and the client's first-render read
 * so both sides derive the same number from the same bytes — that identity is
 * what keeps hydration clean.
 *
 * Returns `null` (not a default) when there is no usable value, so callers can
 * tell "no cookie" apart from "cookie says desktop" and fall through to the UA
 * heuristic.
 */
export function parseSsrViewportCookie(cookieHeader: string | null | undefined): number | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(COOKIE_PATTERN);
  if (!match) return null;

  const width = Number.parseInt(match[1], 10);
  if (!Number.isFinite(width)) return null;
  if (width < MIN_PLAUSIBLE_WIDTH || width > MAX_PLAUSIBLE_WIDTH) return null;
  return width;
}

/**
 * The shared resolution core: cookie wins, User-Agent is the fallback, desktop
 * is the final fallback.
 *
 * Both sides call this. The server passes the request's `Cookie` /
 * `User-Agent` headers; the browser passes `document.cookie` /
 * `navigator.userAgent`. Same inputs → same width → matching first renders.
 */
export function resolveSsrViewportWidth(
  cookieHeader: string | null | undefined,
  userAgent: string | null | undefined
): number {
  const fromCookie = parseSsrViewportCookie(cookieHeader);
  if (fromCookie !== null) return fromCookie;

  const ua = userAgent || "";
  if (TABLET_UA_PATTERN.test(ua)) return SSR_VIEWPORT.TABLET;
  if (MOBILE_UA_PATTERN.test(ua)) return SSR_VIEWPORT.MOBILE;

  return SSR_VIEWPORT.DESKTOP;
}

/**
 * Derive the SSR viewport height that pairs with a detected width.
 *
 * Rounded to an integer so the frame never ships fractional pixel geometry
 * into the HTML.
 */
export function detectSsrViewportHeight(width: number): number {
  const ratio = width <= PORTRAIT_MAX_WIDTH ? PORTRAIT_HEIGHT_RATIO : LANDSCAPE_HEIGHT_RATIO;
  return Math.round(width * ratio);
}

/**
 * Detect the viewport width for SSR from an explicit request object. Suitable
 * for use directly inside a route loader.
 */
export function detectSsrViewportWidth(request: HeaderSource): number {
  if (!request) return SSR_VIEWPORT.DESKTOP;
  return resolveSsrViewportWidth(
    request.headers.get("cookie"),
    request.headers.get("user-agent")
  );
}

/**
 * Detect the viewport from Expo Server's ambient request scope.
 *
 * The try/catch is mandatory, not defensive politeness: this module is
 * reachable from the client bundle (the root layout's metrics helper imports
 * it), and `requestHeaders()` throws whenever there is no active request
 * scope — in the browser, during static export, and in unit tests. Every one
 * of those cases must resolve to the desktop default, which is also the
 * correct answer for a request that carries no signal.
 *
 * Returns a fresh object per call. Never cache it in module scope: two
 * concurrent SSR requests at different widths would scribble over each other.
 */
export function detectSsrViewportFromRequestScope(): SsrViewport {
  let width: number = SSR_VIEWPORT.DESKTOP;
  try {
    const headers = requestHeaders();
    width = resolveSsrViewportWidth(headers.get("cookie"), headers.get("user-agent"));
  } catch {
    // No request scope — keep the desktop default.
  }
  return { width, height: detectSsrViewportHeight(width) };
}

// ---------------------------------------------------------------------------
// Loader wrapper — the per-route adoption surface, for routes that also want
// the width in loader data.
// ---------------------------------------------------------------------------

type LoaderRequest = { url: string; headers: { get(name: string): string | null } } | undefined;
type LoaderParams = Record<string, string | string[]>;
type AnyLoader<T> = (request: LoaderRequest, params: LoaderParams) => Promise<T> | T;

export type WithSsrViewport<T> = T & { ssrViewportWidth: number };

/**
 * Wrap a loader (or pass `() => ({})` when you don't have other loader data)
 * so its return value includes a server-detected `ssrViewportWidth`.
 *
 * Type inference is preserved: callers see the original loader's return type
 * intersected with `{ ssrViewportWidth: number }`.
 */
export function withSsrViewport<T>(inner: AnyLoader<T>): AnyLoader<WithSsrViewport<T>> {
  return async (request, params) => {
    const data = await inner(request, params);
    return { ...data, ssrViewportWidth: detectSsrViewportWidth(request) };
  };
}
