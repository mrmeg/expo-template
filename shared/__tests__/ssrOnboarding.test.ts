/**
 * Tests for the SSR onboarding cookie helpers.
 *
 * This parse decides whether the server renders the onboarding gate or the app
 * shell, and the same function seeds the client's first render, so a parse
 * disagreement between the two sides is a hydration mismatch. The regressions
 * that matter:
 *   - only the exact "1" value counts as seen
 *   - the cookie is matched on a real cookie boundary, so a longer cookie name
 *     ending in `has-seen-onboarding` can't spoof it
 *   - a missing header / missing request resolves to false (new visitor)
 *   - the request-scope read never throws when there is no active scope —
 *     it ships in the client bundle, where `requestHeaders()` always throws
 */

import {
  ONBOARDING_SEEN_COOKIE_NAME,
  ONBOARDING_SEEN_COOKIE_VALUE,
  detectOnboardingSeen,
  detectOnboardingSeenFromRequestScope,
  parseOnboardingSeenCookie,
} from "../ssrOnboarding";

function requestWithCookie(cookie: string | null) {
  return { headers: { get: (name: string) => (name === "cookie" ? cookie : null) } };
}

describe("onboarding cookie constants", () => {
  it("matches the key the store persists under", () => {
    expect(ONBOARDING_SEEN_COOKIE_NAME).toBe("has-seen-onboarding");
    expect(ONBOARDING_SEEN_COOKIE_VALUE).toBe("1");
  });
});

describe("parseOnboardingSeenCookie", () => {
  it("returns true for the seen value", () => {
    expect(parseOnboardingSeenCookie("has-seen-onboarding=1")).toBe(true);
  });

  it("finds the cookie among others regardless of position", () => {
    expect(parseOnboardingSeenCookie("mrmeg-vw=1280; has-seen-onboarding=1")).toBe(true);
    expect(parseOnboardingSeenCookie("has-seen-onboarding=1; mrmeg-vw=1280")).toBe(true);
    expect(parseOnboardingSeenCookie("a=b; has-seen-onboarding=1; c=d")).toBe(true);
  });

  it("tolerates whitespace around the value", () => {
    expect(parseOnboardingSeenCookie("a=b;   has-seen-onboarding=1  ")).toBe(true);
  });

  it("returns false for an expired/emptied cookie", () => {
    expect(parseOnboardingSeenCookie("has-seen-onboarding=")).toBe(false);
  });

  it("returns false for any value other than the seen value", () => {
    expect(parseOnboardingSeenCookie("has-seen-onboarding=0")).toBe(false);
    expect(parseOnboardingSeenCookie("has-seen-onboarding=true")).toBe(false);
    expect(parseOnboardingSeenCookie("has-seen-onboarding=11")).toBe(false);
  });

  it("does not match a cookie whose name merely ends with the key", () => {
    expect(parseOnboardingSeenCookie("not-has-seen-onboarding=1")).toBe(false);
    expect(parseOnboardingSeenCookie("xhas-seen-onboarding=1")).toBe(false);
  });

  it("returns false for absent, empty, or unrelated cookie headers", () => {
    expect(parseOnboardingSeenCookie(null)).toBe(false);
    expect(parseOnboardingSeenCookie(undefined)).toBe(false);
    expect(parseOnboardingSeenCookie("")).toBe(false);
    expect(parseOnboardingSeenCookie("mrmeg-vw=1280")).toBe(false);
  });
});

describe("detectOnboardingSeen", () => {
  it("reads the cookie off the request", () => {
    expect(detectOnboardingSeen(requestWithCookie("has-seen-onboarding=1"))).toBe(true);
  });

  it("returns false with no cookie header", () => {
    expect(detectOnboardingSeen(requestWithCookie(null))).toBe(false);
  });

  it("returns false with no request (static export / crawler)", () => {
    expect(detectOnboardingSeen(undefined)).toBe(false);
  });
});

describe("detectOnboardingSeenFromRequestScope", () => {
  it("falls back to false instead of throwing when no request scope is active", () => {
    // This is the client-bundle and static-export path: `requestHeaders()`
    // throws, and the guard must swallow it. A throw here would crash render.
    expect(() => detectOnboardingSeenFromRequestScope()).not.toThrow();
    expect(detectOnboardingSeenFromRequestScope()).toBe(false);
  });
});
