// SSR color-scheme detection. Companion to `ssrOnboarding.ts`: the server can't
// read `localStorage` or ask the OS, so without a signal in the request every
// SSR render paints the light theme — a dark-mode visitor gets light HTML, a
// light first client render, then a flip. The blocking script in
// `app/+html.tsx` and `client/features/app/colorSchemeCookie.ts` mirror the
// RESOLVED scheme (never the `system` preference, which the server could not
// resolve) into a `color-scheme` cookie purely so this module can read it back
// during SSR. localStorage stays the client's source of truth; the cookie is a
// first-render hint the client reconciles after mount.
//
// Two read surfaces, like the viewport and onboarding modules:
//   1. `detectColorSchemeFromRequestScope()` — Expo Server's ambient request
//      scope, for the root layout (layouts cannot export loaders).
//   2. `detectColorScheme(request)` — the explicit, loader-friendly form.
import { requestHeaders } from "expo-server";

export type SsrColorScheme = "light" | "dark";

const COOKIE_NAME = "color-scheme";
// Anchored to a cookie boundary so `prefers-color-scheme=dark` can't match.
const COOKIE_PATTERN = new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`);

export const COLOR_SCHEME_COOKIE_NAME = COOKIE_NAME;
/** One year: the client rewrites it on every visit and every theme change. */
export const COLOR_SCHEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

/** `"light"` / `"dark"` from a Cookie header; `undefined` for anything else. */
export function parseColorSchemeCookie(cookieHeader: string | null | undefined): SsrColorScheme | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(COOKIE_PATTERN);
  const value = match?.[1].trim();
  return value === "light" || value === "dark" ? value : undefined;
}

export function detectColorScheme(request: HeaderSource): SsrColorScheme | undefined {
  if (!request) return undefined;
  return parseColorSchemeCookie(request.headers.get("cookie"));
}

/** Reads the request scope; `undefined` (today's light default) when there is none. */
export function detectColorSchemeFromRequestScope(): SsrColorScheme | undefined {
  try {
    return parseColorSchemeCookie(requestHeaders().get("cookie"));
  } catch {
    return undefined;
  }
}

/** The `Set-Cookie`-style string the client writes to `document.cookie`. */
export function colorSchemeCookieString(scheme: SsrColorScheme): string {
  return `${COOKIE_NAME}=${scheme}; path=/; max-age=${COLOR_SCHEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}
