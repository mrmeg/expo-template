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
 *   - so does the `system-color-scheme` cookie, on the browsers that never send
 *     a hint — and the hint wins when both are present, because it describes
 *     THIS request while the cookie describes the previous load
 *   - the request-scope read never throws when there is no active scope —
 *     it ships in the client bundle, where `requestHeaders()` always throws
 *   - and the one `app/+html.tsx` depends on: a REAL signal is distinguishable
 *     from the fallback, and a *known* scheme from a *guessed* one. The shell
 *     may only stamp `data-theme` in the known case; stamping a guess makes the
 *     inline color-scheme script a permanent no-op and un-matches the
 *     `html:not([data-theme])` dark media query, so a hint-less dark-OS
 *     first-timer would get a light paint with both failsafes disabled.
 */

import { SSR_THEME_SEED_DEFAULT } from "@mrmeg/expo-ui/state";

import { SYSTEM_SCHEME_COOKIE_NAME as STORE_SYSTEM_SCHEME_COOKIE_NAME } from "@mrmeg/expo-ui/state";

import {
  SSR_SYSTEM_SCHEME_ATTRIBUTE,
  SSR_THEME_DETECTION_DEFAULT,
  SYSTEM_SCHEME_COOKIE_NAME,
  THEME_CLIENT_HINT_ACCEPT_CH,
  THEME_CLIENT_HINT_HEADER,
  THEME_COOKIE_NAME,
  detectSsrTheme,
  detectSsrThemeFromRequestScope,
  detectSsrThemeSeed,
  detectSsrThemeSeedFromRequestScope,
  parseColorSchemeClientHint,
  parseSystemSchemeCookie,
  parseThemePreferenceCookie,
  resolveSsrScheme,
  resolveSsrThemeDetection,
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

  it("names the resolved-scheme cookie exactly as the store writes it", () => {
    // `packages/ui` can't import from `server/`, so the name is an independent
    // literal on each side. This equality is the only thing keeping the store's
    // write and this module's read on the same cookie — a silent drift here means
    // every `system` visitor quietly falls back to a light server render again.
    expect(SYSTEM_SCHEME_COOKIE_NAME).toBe("system-color-scheme");
    expect(SYSTEM_SCHEME_COOKIE_NAME).toBe(STORE_SYSTEM_SCHEME_COOKIE_NAME);
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

describe("parseSystemSchemeCookie", () => {
  it("reads the two values the store writes", () => {
    expect(parseSystemSchemeCookie("system-color-scheme=dark")).toBe("dark");
    expect(parseSystemSchemeCookie("system-color-scheme=light")).toBe("light");
  });

  it("finds the cookie among others regardless of position", () => {
    expect(
      parseSystemSchemeCookie("user-theme-preference=system; system-color-scheme=dark")
    ).toBe("dark");
    expect(
      parseSystemSchemeCookie("system-color-scheme=dark; user-theme-preference=system")
    ).toBe("dark");
    expect(parseSystemSchemeCookie("a=b; system-color-scheme=light; mrmeg-vw=1280")).toBe("light");
  });

  it("tolerates whitespace around the value", () => {
    expect(parseSystemSchemeCookie("a=b;   system-color-scheme=dark  ")).toBe("dark");
  });

  it("rejects `system` — this cookie carries a RESOLVED scheme, not a preference", () => {
    // A `system` value here would resolve to nothing useful and could end up
    // stamped into `<html data-theme>`.
    expect(parseSystemSchemeCookie("system-color-scheme=system")).toBeNull();
  });

  it("rejects values the store would never write", () => {
    expect(parseSystemSchemeCookie("system-color-scheme=DARK")).toBeNull();
    expect(parseSystemSchemeCookie("system-color-scheme=darker")).toBeNull();
    expect(parseSystemSchemeCookie("system-color-scheme=1")).toBeNull();
    expect(parseSystemSchemeCookie("system-color-scheme=")).toBeNull();
  });

  it("does not match a cookie whose name merely ends with the key", () => {
    expect(parseSystemSchemeCookie("not-system-color-scheme=dark")).toBeNull();
    expect(parseSystemSchemeCookie("xsystem-color-scheme=dark")).toBeNull();
  });

  it("returns null for absent, empty, or unrelated cookie headers", () => {
    expect(parseSystemSchemeCookie(null)).toBeNull();
    expect(parseSystemSchemeCookie(undefined)).toBeNull();
    expect(parseSystemSchemeCookie("")).toBeNull();
    expect(parseSystemSchemeCookie("user-theme-preference=system")).toBeNull();
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

  it("falls back to light for a system preference with no hint and no scheme cookie", () => {
    // The server genuinely cannot know the OS scheme here; light is the value
    // the store has always booted with.
    expect(resolveSsrThemeSeed("user-theme-preference=system")).toEqual({
      userTheme: "system",
      systemTheme: "light",
    });
  });

  it("resolves a system preference from the scheme cookie when no hint arrives", () => {
    expect(
      resolveSsrThemeSeed("user-theme-preference=system; system-color-scheme=dark")
    ).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("prefers the same-request hint over a disagreeing scheme cookie", () => {
    // The cookie is the PREVIOUS load's reading; the hint describes this request,
    // so a visitor who flipped their OS theme gets the current answer.
    expect(
      resolveSsrThemeSeed("user-theme-preference=system; system-color-scheme=light", "dark")
    ).toEqual({ userTheme: "system", systemTheme: "dark" });
    expect(
      resolveSsrThemeSeed("user-theme-preference=system; system-color-scheme=dark", "light")
    ).toEqual({ userTheme: "system", systemTheme: "light" });
  });

  it("falls back to the cookie when the hint is present but unparseable", () => {
    expect(
      resolveSsrThemeSeed("system-color-scheme=dark", "no-preference")
    ).toEqual({ userTheme: "system", systemTheme: "dark" });
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

describe("resolveSsrThemeDetection", () => {
  it("reports no signal, and nothing to stamp, for a bare request", () => {
    const detection = resolveSsrThemeDetection(null);

    expect(detection).toBe(SSR_THEME_DETECTION_DEFAULT);
    expect(detection.hasSignal).toBe(false);
    // `null`, not "light". This is what tells +html.tsx to omit `data-theme` so
    // the inline script and the dark media query stay live.
    expect(detection.scheme).toBeNull();
    expect(detection.seed).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("reports no signal for cookies that aren't the theme cookie", () => {
    expect(resolveSsrThemeDetection("mrmeg-vw=1280; has-seen-onboarding=1")).toBe(
      SSR_THEME_DETECTION_DEFAULT
    );
  });

  it("reports no signal for a theme cookie the store would never have written", () => {
    expect(resolveSsrThemeDetection("user-theme-preference=sepia")).toBe(
      SSR_THEME_DETECTION_DEFAULT
    );
  });

  it("reports a known scheme for an explicit dark cookie", () => {
    expect(resolveSsrThemeDetection("user-theme-preference=dark")).toEqual({
      seed: { userTheme: "dark", systemTheme: "light" },
      hasSignal: true,
      scheme: "dark",
    });
  });

  it("reports a known scheme for an explicit light cookie", () => {
    expect(resolveSsrThemeDetection("user-theme-preference=light")).toEqual({
      seed: { userTheme: "light", systemTheme: "light" },
      hasSignal: true,
      scheme: "light",
    });
  });

  it("reports a known scheme for a `system` cookie WITH a client hint", () => {
    expect(resolveSsrThemeDetection("user-theme-preference=system", "dark")).toEqual({
      seed: { userTheme: "system", systemTheme: "dark" },
      hasSignal: true,
      scheme: "dark",
    });
  });

  it("reports a known scheme for a hint-only first visit", () => {
    // No cookie yet, but the browser told us the OS scheme — that's real.
    expect(resolveSsrThemeDetection(null, "dark")).toEqual({
      seed: { userTheme: "system", systemTheme: "dark" },
      hasSignal: true,
      scheme: "dark",
    });
  });

  it("reports a signal but an UNKNOWN scheme for `system` with no scheme channel", () => {
    // The preference is known; the scheme it resolves to is the light fallback,
    // i.e. a guess. `scheme` must stay null so the browser-side failsafes get
    // the chance to do better.
    const detection = resolveSsrThemeDetection("user-theme-preference=system");

    expect(detection.hasSignal).toBe(true);
    expect(detection.scheme).toBeNull();
    // The seed still renders with light, and the client derives the same value
    // from the same cookie, so hydration agrees.
    expect(detection.seed).toEqual({ userTheme: "system", systemTheme: "light" });
  });

  it("reports a KNOWN scheme for `system` resolved from the scheme cookie", () => {
    // The whole point of the second cookie: Safari and Firefox never send the
    // hint, so without this a `system` visitor was unresolvable forever.
    expect(
      resolveSsrThemeDetection("user-theme-preference=system; system-color-scheme=dark")
    ).toEqual({
      seed: { userTheme: "system", systemTheme: "dark" },
      hasSignal: true,
      scheme: "dark",
    });
  });

  it("treats the scheme cookie alone as a signal (no preference cookie yet)", () => {
    // No explicit preference means the implicit `system` default, so the scheme
    // cookie is enough on its own.
    expect(resolveSsrThemeDetection("system-color-scheme=dark")).toEqual({
      seed: { userTheme: "system", systemTheme: "dark" },
      hasSignal: true,
      scheme: "dark",
    });
  });

  it("lets the same-request hint beat a disagreeing scheme cookie", () => {
    const detection = resolveSsrThemeDetection(
      "user-theme-preference=system; system-color-scheme=light",
      "dark"
    );

    expect(detection.scheme).toBe("dark");
    expect(detection.seed.systemTheme).toBe("dark");
  });

  it("reports no signal for a scheme cookie the store would never have written", () => {
    expect(resolveSsrThemeDetection("system-color-scheme=sepia")).toBe(
      SSR_THEME_DETECTION_DEFAULT
    );
    // `system` is a preference value, not a resolved scheme.
    expect(resolveSsrThemeDetection("system-color-scheme=system")).toBe(
      SSR_THEME_DETECTION_DEFAULT
    );
  });

  it("reports no signal for a cookie whose name merely ends with the scheme key", () => {
    expect(resolveSsrThemeDetection("xsystem-color-scheme=dark")).toBe(
      SSR_THEME_DETECTION_DEFAULT
    );
  });

  it("keeps an explicit preference winning over the scheme cookie", () => {
    const detection = resolveSsrThemeDetection(
      "user-theme-preference=light; system-color-scheme=dark"
    );

    expect(detection.scheme).toBe("light");
    // Still recorded, for a post-mount switch to `system`.
    expect(detection.seed.systemTheme).toBe("dark");
  });

  it("lets an explicit preference win over a contradicting hint", () => {
    const detection = resolveSsrThemeDetection("user-theme-preference=light", "dark");

    expect(detection.scheme).toBe("light");
    // systemTheme is still recorded for a post-mount switch to "system".
    expect(detection.seed.systemTheme).toBe("dark");
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

describe("detectSsrTheme", () => {
  it("reads the cookie off the request and reports a known scheme", () => {
    const detection = detectSsrTheme(requestWith({ cookie: "user-theme-preference=dark" }));

    expect(detection.hasSignal).toBe(true);
    expect(detection.scheme).toBe("dark");
  });

  it("reads the client hint off the request", () => {
    const detection = detectSsrTheme(
      requestWith({
        cookie: "user-theme-preference=system",
        "sec-ch-prefers-color-scheme": "dark",
      })
    );

    expect(detection.scheme).toBe("dark");
    expect(detection.seed).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("reads the scheme cookie off the SAME cookie header as the preference", () => {
    const detection = detectSsrTheme(
      requestWith({ cookie: "user-theme-preference=system; system-color-scheme=dark" })
    );

    expect(detection.scheme).toBe("dark");
    expect(detection.seed).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("reports no signal for a request with no theme headers", () => {
    expect(detectSsrTheme(requestWith({ cookie: null }))).toBe(SSR_THEME_DETECTION_DEFAULT);
  });

  it("reports no signal with no request (static export / crawler)", () => {
    expect(detectSsrTheme(undefined)).toBe(SSR_THEME_DETECTION_DEFAULT);
  });
});

describe("detectSsrThemeFromRequestScope", () => {
  it("falls back to the no-signal default instead of throwing with no active scope", () => {
    // Client bundle and static export: `requestHeaders()` throws. The guard has
    // to swallow it, and the result must be the *no-signal* answer — a
    // static-exported page has no per-visitor theme to stamp.
    expect(() => detectSsrThemeFromRequestScope()).not.toThrow();
    expect(detectSsrThemeFromRequestScope()).toBe(SSR_THEME_DETECTION_DEFAULT);
    expect(detectSsrThemeFromRequestScope().scheme).toBeNull();
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
