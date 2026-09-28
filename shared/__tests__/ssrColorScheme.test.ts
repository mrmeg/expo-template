/**
 * The `color-scheme` cookie the server reads to paint the visitor's theme on
 * the first render. Mirrors ssrOnboarding.test.ts; `requestHeaders()` throws
 * with no active scope, so the ambient form falls back to `undefined`.
 */
import {
  COLOR_SCHEME_COOKIE_NAME,
  colorSchemeCookieString,
  detectColorScheme,
  detectColorSchemeFromRequestScope,
  parseColorSchemeCookie,
} from "../ssrColorScheme";

describe("parseColorSchemeCookie", () => {
  it("returns light or dark", () => {
    expect(parseColorSchemeCookie("color-scheme=dark")).toBe("dark");
    expect(parseColorSchemeCookie("color-scheme=light")).toBe("light");
  });

  it("finds the cookie among others regardless of position and whitespace", () => {
    expect(parseColorSchemeCookie("a=1; color-scheme= dark ;b=2")).toBe("dark");
    expect(parseColorSchemeCookie("has-seen-onboarding=1;color-scheme=light")).toBe("light");
  });

  it("returns undefined for absent, empty, expired, or unknown values", () => {
    expect(parseColorSchemeCookie(undefined)).toBeUndefined();
    expect(parseColorSchemeCookie("")).toBeUndefined();
    expect(parseColorSchemeCookie("color-scheme=")).toBeUndefined();
    expect(parseColorSchemeCookie("color-scheme=system")).toBeUndefined();
    expect(parseColorSchemeCookie("color-scheme=DARK")).toBeUndefined();
  });

  it("does not match a cookie whose name merely ends with the key", () => {
    expect(parseColorSchemeCookie("prefers-color-scheme=dark")).toBeUndefined();
  });
});

describe("detectColorScheme", () => {
  it("reads the cookie off the request", () => {
    const request = { headers: new Headers({ cookie: "color-scheme=dark" }) };
    expect(detectColorScheme(request)).toBe("dark");
  });

  it("returns undefined with no request or no cookie header", () => {
    expect(detectColorScheme(undefined)).toBeUndefined();
    expect(detectColorScheme({ headers: new Headers() })).toBeUndefined();
  });
});

describe("detectColorSchemeFromRequestScope", () => {
  it("is undefined outside a request scope (the client bundle, tests)", () => {
    expect(detectColorSchemeFromRequestScope()).toBeUndefined();
  });
});

describe("colorSchemeCookieString", () => {
  it("writes a year-long, path-wide, Lax cookie under the shared name", () => {
    const cookie = colorSchemeCookieString("dark");
    expect(cookie.startsWith(`${COLOR_SCHEME_COOKIE_NAME}=dark; path=/; max-age=`)).toBe(true);
    expect(cookie).toMatch(/SameSite=Lax$/);
  });
});
