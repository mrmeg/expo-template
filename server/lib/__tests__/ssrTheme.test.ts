/**
 * Tests for the SSR theme cookie helpers.
 *
 * This parse decides which scheme the server render paints, and the same
 * functions seed the client's first render, so a parse disagreement between
 * the two sides is a hydration mismatch. The regressions that matter:
 *   - only the three values the store writes count as a preference
 *   - the cookie is matched on a real cookie boundary, so a longer cookie name
 *     ending in `user-theme-preference` can't spoof it
 *   - a missing header / missing request resolves to the SSR-safe default
 *     (system + light), which is also correct for a brand-new visitor
 *   - `Sec-CH-Prefers-Color-Scheme` resolves `system` when the browser sends it
 *   - the request-scope read never throws when there is no active scope —
 *     it ships in the client bundle, where `requestHeaders()` always throws
 */

import { SSR_THEME_SEED_DEFAULT } from "@mrmeg/expo-ui/state";

import {
  SSR_SYSTEM_SCHEME_ATTRIBUTE,
  THEME_CLIENT_HINT_ACCEPT_CH,
  THEME_CLIENT_HINT_HEADER,
  THEME_COOKIE_NAME,
  detectSsrThemeSeed,
  detectSsrThemeSeedFromRequestScope,
  parseColorSchemeClientHint,
  parseThemePreferenceCookie,
  resolveSsrScheme,
  resolveSsrThemeSeed,
} from "../ssrTheme";

function requestWith(headers: Record<string, string | null>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe("theme cookie constants", () => {
  it("matches the key the store persists under", () => {
    // packages/ui/src/state/themeStore.ts writes both localStorage and the
    // cookie under this exact name.
    expect(THEME_COOKIE_NAME).toBe("user-theme-preference");
  });

  it("names the client hint header and its Accept-CH opt-in consistently", () => {
    expect(THEME_CLIENT_HINT_HEADER).toBe("sec-ch-prefers-color-scheme");
    expect(THEME_CLIENT_HINT_ACCEPT_CH).toBe("Sec-CH-Prefers-Color-Scheme");
    expect(THEME_CLIENT_HINT_ACCEPT_CH.toLowerCase()).toBe(THEME_CLIENT_HINT_HEADER);
  });

  it("exposes the html attribute the client reads the server's system scheme from", () => {
    expect(SSR_SYSTEM_SCHEME_ATTRIBUTE).toBe("data-ssr-system-scheme");
  });
});

describe("parseThemePreferenceCookie", () => {
  it("returns each value the store can write", () => {
    expect(parseThemePreferenceCookie("user-theme-preference=dark")).toBe("dark");
    expect(parseThemePreferenceCookie("user-theme-preference=light")).toBe("light");
    expect(parseThemePreferenceCookie("user-theme-preference=system")).toBe("system");
  });

  it("finds the cookie among others regardless of position", () => {
    expect(parseThemePreferenceCookie("mrmeg-vw=1280; user-theme-preference=dark")).toBe("dark");
    expect(parseThemePreferenceCookie("user-theme-preference=dark; mrmeg-vw=1280")).toBe("dark");
    expect(
      parseThemePreferenceCookie("a=b; user-theme-preference=dark; has-seen-onboarding=1")
    ).toBe("dark");
  });

  it("tolerates whitespace around the value", () => {
    expect(parseThemePreferenceCookie("a=b;   user-theme-preference=dark  ")).toBe("dark");
  });

  it("returns null for an expired/emptied cookie", () => {
    expect(parseThemePreferenceCookie("user-theme-preference=")).toBeNull();
  });

  it("returns null for values the store would never write", () => {
    expect(parseThemePreferenceCookie("user-theme-preference=DARK")).toBeNull();
    expect(parseThemePreferenceCookie("user-theme-preference=darker")).toBeNull();
    expect(parseThemePreferenceCookie("user-theme-preference=1")).toBeNull();
    expect(parseThemePreferenceCookie("user-theme-preference=auto")).toBeNull();
  });

  it("does not match a cookie whose name merely ends with the key", () => {
    expect(parseThemePreferenceCookie("not-user-theme-preference=dark")).toBeNull();
    expect(parseThemePreferenceCookie("xuser-theme-preference=dark")).toBeNull();
  });

  it("returns null for absent, empty, or unrelated cookie headers", () => {
    expect(parseThemePreferenceCookie(null)).toBeNull();
    expect(parseThemePreferenceCookie(undefined)).toBeNull();
    expect(parseThemePreferenceCookie("")).toBeNull();
    expect(parseThemePreferenceCookie("mrmeg-vw=1280")).toBeNull();
  });
});

describe("parseColorSchemeClientHint", () => {
  it("reads the two valid hint values, case-insensitively", () => {
    expect(parseColorSchemeClientHint("dark")).toBe("dark");
    expect(parseColorSchemeClientHint("light")).toBe("light");
    expect(parseColorSchemeClientHint(" Dark ")).toBe("dark");
  });

  it("returns null for absent or unknown hints", () => {
    expect(parseColorSchemeClientHint(null)).toBeNull();
    expect(parseColorSchemeClientHint(undefined)).toBeNull();
    expect(parseColorSchemeClientHint("")).toBeNull();
    expect(parseColorSchemeClientHint("no-preference")).toBeNull();
  });
});

describe("resolveSsrThemeSeed", () => {
  it("returns the shared default object when there is no signal at all", () => {
    // Reference identity matters: consumers compare against the default to
    // skip work, and the package exports the same object.
    expect(resolveSsrThemeSeed(null)).toBe(SSR_THEME_SEED_DEFAULT);
    expect(resolveSsrThemeSeed("mrmeg-vw=1280", null)).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("carries an explicit dark preference through", () => {
    expect(resolveSsrThemeSeed("user-theme-preference=dark")).toEqual({
      userTheme: "dark",
      systemTheme: "light",
    });
  });

  it("resolves a system preference from the client hint", () => {
    expect(resolveSsrThemeSeed("user-theme-preference=system", "dark")).toEqual({
      userTheme: "system",
      systemTheme: "dark",
    });
  });

  it("uses the client hint alone for a first-time visitor with no cookie", () => {
    expect(resolveSsrThemeSeed(null, "dark")).toEqual({
      userTheme: "system",
      systemTheme: "dark",
    });
  });

  it("falls back to light for a system preference with no hint", () => {
    // The server genuinely cannot know the OS scheme here; light is the value
    // the store has always booted with.
    expect(resolveSsrThemeSeed("user-theme-preference=system")).toEqual({
      userTheme: "system",
      systemTheme: "light",
    });
  });

  it("lets an explicit preference win over a contradicting hint", () => {
    const seed = resolveSsrThemeSeed("user-theme-preference=light", "dark");
    expect(seed.userTheme).toBe("light");
    // systemTheme is still recorded so a post-mount switch to "system" starts
    // from a real value, but it must not change the resolved scheme.
    expect(seed.systemTheme).toBe("dark");
    expect(resolveSsrScheme(seed)).toBe("light");
  });
});

describe("resolveSsrScheme", () => {
  it("resolves the scheme the server render will paint", () => {
    expect(resolveSsrScheme({ userTheme: "dark", systemTheme: "light" })).toBe("dark");
    expect(resolveSsrScheme({ userTheme: "light", systemTheme: "dark" })).toBe("light");
    expect(resolveSsrScheme({ userTheme: "system", systemTheme: "dark" })).toBe("dark");
    expect(resolveSsrScheme({ userTheme: "system", systemTheme: "light" })).toBe("light");
    expect(resolveSsrScheme(SSR_THEME_SEED_DEFAULT)).toBe("light");
  });
});

describe("detectSsrThemeSeed", () => {
  it("reads the cookie off the request", () => {
    expect(detectSsrThemeSeed(requestWith({ cookie: "user-theme-preference=dark" }))).toEqual({
      userTheme: "dark",
      systemTheme: "light",
    });
  });

  it("reads the client hint off the request", () => {
    const request = requestWith({
      cookie: "user-theme-preference=system",
      "sec-ch-prefers-color-scheme": "dark",
    });
    expect(detectSsrThemeSeed(request)).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("returns the default with no cookie header", () => {
    expect(detectSsrThemeSeed(requestWith({ cookie: null }))).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("returns the default with no request (static export / crawler)", () => {
    expect(detectSsrThemeSeed(undefined)).toBe(SSR_THEME_SEED_DEFAULT);
  });
});

describe("detectSsrThemeSeedFromRequestScope", () => {
  it("falls back to the default instead of throwing when no request scope is active", () => {
    // This is the client-bundle and static-export path: `requestHeaders()`
    // throws, and the guard must swallow it. A throw here would crash render.
    expect(() => detectSsrThemeSeedFromRequestScope()).not.toThrow();
    expect(detectSsrThemeSeedFromRequestScope()).toBe(SSR_THEME_SEED_DEFAULT);
  });
});
