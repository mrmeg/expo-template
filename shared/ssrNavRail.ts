// SSR nav-rail state. Companion to `ssrColorScheme.ts`: the desktop web nav
// rail can be collapsed from its header, and the choice must survive reloads
// without the server painting an open rail that the client then snaps shut.
// The cookie is the only persistence — a pure layout preference has nothing
// for localStorage to add — so the server and the first client render read the
// same bytes and hydration stays clean.
//
// Two read surfaces, like the other ssr* modules:
//   1. `detectNavRailCollapsedFromRequestScope()` — Expo Server's ambient
//      request scope, for the (main) layout (layouts cannot export loaders).
//   2. `detectNavRailCollapsed(request)` — the explicit, loader-friendly form.
import { requestHeaders } from "expo-server";

const COOKIE_NAME = "nav-rail-collapsed";
// Anchored to a cookie boundary so `x-nav-rail-collapsed=1` can't match.
const COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`);
const COLLAPSED_VALUE = "1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const NAV_RAIL_COOKIE_NAME = COOKIE_NAME;

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

/** True only for an exact `nav-rail-collapsed=1`; the rail is open by default. */
export function parseNavRailCollapsedCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(COOKIE_PATTERN);
  return match ? match[1].trim() === COLLAPSED_VALUE : false;
}

export function detectNavRailCollapsed(request: HeaderSource): boolean {
  if (!request) return false;
  return parseNavRailCollapsedCookie(request.headers.get("cookie"));
}

/**
 * Reads the request scope. `requestHeaders()` throws outside a request (the
 * browser, static export, tests), and every one of those means "open".
 */
export function detectNavRailCollapsedFromRequestScope(): boolean {
  try {
    return parseNavRailCollapsedCookie(requestHeaders().get("cookie"));
  } catch {
    return false;
  }
}

/** The string the client writes to `document.cookie`; expanding expires it. */
export function navRailCookieString(collapsed: boolean): string {
  return collapsed
    ? `${COOKIE_NAME}=${COLLAPSED_VALUE}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    : `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
