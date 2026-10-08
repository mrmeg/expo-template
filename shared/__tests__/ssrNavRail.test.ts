/**
 * The nav-rail cookie seeds both the server render and the client's first
 * render, so the parse must agree on both sides and default to an open rail.
 */
import {
  detectNavRailCollapsed,
  detectNavRailCollapsedFromRequestScope,
  navRailCookieString,
  parseNavRailCollapsedCookie,
} from "../ssrNavRail";

function requestWithCookie(cookie: string | null) {
  return { headers: { get: (name: string) => (name === "cookie" ? cookie : null) } };
}

describe("parseNavRailCollapsedCookie", () => {
  it("is collapsed only for the exact value", () => {
    expect(parseNavRailCollapsedCookie("nav-rail-collapsed=1")).toBe(true);
    expect(parseNavRailCollapsedCookie("a=b; nav-rail-collapsed=1; c=d")).toBe(true);
    expect(parseNavRailCollapsedCookie("nav-rail-collapsed=")).toBe(false);
    expect(parseNavRailCollapsedCookie("nav-rail-collapsed=true")).toBe(false);
  });

  it("defaults to open without a cookie", () => {
    expect(parseNavRailCollapsedCookie(undefined)).toBe(false);
    expect(parseNavRailCollapsedCookie("")).toBe(false);
  });

  it("matches on a cookie boundary", () => {
    expect(parseNavRailCollapsedCookie("x-nav-rail-collapsed=1")).toBe(false);
  });
});

describe("detectNavRailCollapsed", () => {
  it("reads the request's cookie header", () => {
    expect(detectNavRailCollapsed(requestWithCookie("nav-rail-collapsed=1"))).toBe(true);
    expect(detectNavRailCollapsed(requestWithCookie(null))).toBe(false);
    expect(detectNavRailCollapsed(undefined)).toBe(false);
  });

  it("resolves to open outside a request scope instead of throwing", () => {
    expect(detectNavRailCollapsedFromRequestScope()).toBe(false);
  });
});

describe("navRailCookieString", () => {
  it("writes the collapsed value and expires it on expand", () => {
    expect(navRailCookieString(true)).toMatch(/^nav-rail-collapsed=1; path=\/; max-age=\d+/);
    expect(navRailCookieString(false)).toContain("max-age=0");
  });

  it("round-trips through the parser", () => {
    expect(parseNavRailCollapsedCookie(navRailCookieString(true).split(";")[0])).toBe(true);
    expect(parseNavRailCollapsedCookie(navRailCookieString(false).split(";")[0])).toBe(false);
  });
});
