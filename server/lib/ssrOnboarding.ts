// SSR onboarding-state detection. Companion to `ssrViewport.ts`: the server
// can't read `localStorage`, so without a signal in the request every SSR
// render emits the onboarding gate — even for visitors who finished onboarding
// months ago. `client/features/onboarding/onboardingStore.ts` mirrors the
// persisted flag into a `has-seen-onboarding` cookie purely so this module can
// read it back during SSR.
//
// localStorage stays the client's source of truth. The cookie is a
// server-render hint only, and the client reconciles against localStorage
// after mount (a stale cookie can never trap a user in the wrong shell).
//
// Two read surfaces:
//
//   1. `detectOnboardingSeenFromRequestScope()` — reads Expo Server's
//      ambient request scope. This is what the store uses, because the
//      onboarding gate lives in the ROOT LAYOUT and layouts cannot export
//      loaders (`@expo/router-server`'s server manifest only carries leaf
//      html routes), so there is no loader to hang the value off.
//
//   2. `detectOnboardingSeen(request)` — the explicit, loader-friendly form,
//      matching `detectSsrViewportWidth(request)`. Use this if you ever need
//      the flag inside a leaf route's loader:
//
//        export const loader = async (request) => ({
//          hasSeenOnboarding: detectOnboardingSeen(request),
//        });

import { requestHeaders } from "expo-server";

const COOKIE_NAME = "has-seen-onboarding";

// Anchored to a cookie boundary so `not-has-seen-onboarding=1` can't match.
const COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`);

// The store writes exactly "1" for seen and expires the cookie (max-age=0)
// otherwise, so a present-but-not-"1" value is treated as not seen.
const SEEN_VALUE = "1";

export const ONBOARDING_SEEN_COOKIE_NAME = COOKIE_NAME;
export const ONBOARDING_SEEN_COOKIE_VALUE = SEEN_VALUE;

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

/**
 * Parse a raw `Cookie` header (or `document.cookie`) for the onboarding flag.
 * Shared by the server read and the client's first-render read so both sides
 * derive the same boolean from the same bytes — that identity is what keeps
 * hydration clean.
 */
export function parseOnboardingSeenCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(COOKIE_PATTERN);
  return match ? match[1].trim() === SEEN_VALUE : false;
}

/**
 * Detect whether the visitor has completed onboarding from an explicit
 * request object. Suitable for use directly inside a route loader.
 */
export function detectOnboardingSeen(request: HeaderSource): boolean {
  if (!request) return false;
  return parseOnboardingSeenCookie(request.headers.get("cookie"));
}

/**
 * Detect the flag from Expo Server's ambient request scope.
 *
 * The try/catch is mandatory, not defensive politeness: this module is
 * reachable from the client bundle (the onboarding store imports it), and
 * `requestHeaders()` throws whenever there is no active request scope —
 * in the browser, during static export, and in unit tests. Every one of
 * those cases must resolve to `false`, which is also the correct answer
 * for a visitor with no cookie.
 */
export function detectOnboardingSeenFromRequestScope(): boolean {
  try {
    return parseOnboardingSeenCookie(requestHeaders().get("cookie"));
  } catch {
    return false;
  }
}
