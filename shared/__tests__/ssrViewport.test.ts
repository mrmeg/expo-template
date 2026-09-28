/**
 * Tests for the SSR viewport-width helpers.
 *
 * This width decides the frame the whole tree is laid out at server-side, and
 * the same value seeds `useDimensions` on the client's first render, so a
 * disagreement between the two sides is a hydration mismatch. The regressions
 * that matter:
 *   - the cookie is matched on a real cookie boundary, so a longer cookie name
 *     ending in `mrmeg-vw` can't spoof it
 *   - implausible cookie values fall through to the UA/default path instead of
 *     laying the tree out at 0 or 99999
 *   - the request-scope read never throws when there is no active scope — it
 *     ships in the client bundle, where `requestHeaders()` always throws
 *   - the derived height stays in the aspect band the default pair establishes
 */

import {
  SSR_VIEWPORT,
  SSR_VIEWPORT_COOKIE_NAME,
  detectSsrViewportFromRequestScope,
  detectSsrViewportHeight,
  detectSsrViewportWidth,
  parseSsrViewportCookie,
  withSsrViewport,
} from "../ssrViewport";

function requestWith(headers: Record<string, string | null>) {
  return {
    url: "http://localhost/showcase",
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

describe("viewport cookie constant", () => {
  it("matches the key useDimensions writes", () => {
    expect(SSR_VIEWPORT_COOKIE_NAME).toBe("mrmeg-vw");
  });
});

describe("parseSsrViewportCookie", () => {
  it("returns the width for a plausible value", () => {
    expect(parseSsrViewportCookie("mrmeg-vw=1440")).toBe(1440);
  });

  it("finds the cookie among others regardless of position", () => {
    expect(parseSsrViewportCookie("has-seen-onboarding=1; mrmeg-vw=1440")).toBe(1440);
    expect(parseSsrViewportCookie("mrmeg-vw=1440; has-seen-onboarding=1")).toBe(1440);
    expect(parseSsrViewportCookie("a=b; mrmeg-vw=1440; c=d")).toBe(1440);
  });

  it("tolerates whitespace around the value", () => {
    expect(parseSsrViewportCookie("a=b;   mrmeg-vw=1440  ")).toBe(1440);
  });

  it("does not match a cookie whose name merely ends with the key", () => {
    // The old unanchored pattern matched this and laid the tree out at 1.
    expect(parseSsrViewportCookie("not-mrmeg-vw=1")).toBeNull();
    expect(parseSsrViewportCookie("xmrmeg-vw=1")).toBeNull();
  });

  it("rejects implausible widths so a bad cookie can't zero the layout", () => {
    expect(parseSsrViewportCookie("mrmeg-vw=0")).toBeNull();
    expect(parseSsrViewportCookie("mrmeg-vw=42")).toBeNull();
    expect(parseSsrViewportCookie("mrmeg-vw=99999")).toBeNull();
  });

  it("rejects non-numeric and empty values", () => {
    expect(parseSsrViewportCookie("mrmeg-vw=")).toBeNull();
    expect(parseSsrViewportCookie("mrmeg-vw=wide")).toBeNull();
    expect(parseSsrViewportCookie("mrmeg-vw=12.5")).toBeNull();
  });

  it("returns null for absent, empty, or unrelated cookie headers", () => {
    expect(parseSsrViewportCookie(null)).toBeNull();
    expect(parseSsrViewportCookie(undefined)).toBeNull();
    expect(parseSsrViewportCookie("")).toBeNull();
    expect(parseSsrViewportCookie("has-seen-onboarding=1")).toBeNull();
  });
});

describe("detectSsrViewportWidth", () => {
  it("prefers the cookie over the User-Agent", () => {
    const request = requestWith({ cookie: "mrmeg-vw=1440", "user-agent": IPHONE_UA });
    expect(detectSsrViewportWidth(request)).toBe(1440);
  });

  it("falls back to the UA heuristic with no cookie", () => {
    expect(detectSsrViewportWidth(requestWith({ "user-agent": IPHONE_UA }))).toBe(
      SSR_VIEWPORT.MOBILE
    );
    expect(detectSsrViewportWidth(requestWith({ "user-agent": IPAD_UA }))).toBe(
      SSR_VIEWPORT.TABLET
    );
    expect(detectSsrViewportWidth(requestWith({ "user-agent": MAC_UA }))).toBe(
      SSR_VIEWPORT.DESKTOP
    );
  });

  it("falls back to the UA heuristic when the cookie is implausible", () => {
    const request = requestWith({ cookie: "mrmeg-vw=0", "user-agent": IPHONE_UA });
    expect(detectSsrViewportWidth(request)).toBe(SSR_VIEWPORT.MOBILE);
  });

  it("defaults to desktop with no signal at all (crawlers, no UA)", () => {
    expect(detectSsrViewportWidth(requestWith({}))).toBe(SSR_VIEWPORT.DESKTOP);
    expect(detectSsrViewportWidth(undefined)).toBe(SSR_VIEWPORT.DESKTOP);
  });
});

describe("detectSsrViewportHeight", () => {
  it("returns the package default height for the default width", () => {
    // The 1280x800 pair is the contract SSR_VIEWPORT_DEFAULT_* encodes; the
    // derived height must not drift away from it for desktop.
    expect(detectSsrViewportHeight(SSR_VIEWPORT.DESKTOP)).toBe(800);
  });

  it("returns a portrait height for phone widths and landscape for desktop", () => {
    // useDimensions derives `orientation` from width vs height, and layout
    // branches on it — so the SSR pair has to land on the right side.
    expect(detectSsrViewportHeight(SSR_VIEWPORT.MOBILE)).toBeGreaterThan(SSR_VIEWPORT.MOBILE);
    expect(detectSsrViewportHeight(SSR_VIEWPORT.DESKTOP)).toBeLessThan(SSR_VIEWPORT.DESKTOP);
  });

  it("is always a positive integer", () => {
    // Fractional or zero heights would ship `height:0px` / `height:693.33px`
    // into the SSR frame, which is the class of garbage geometry this fixes.
    for (const width of [320, 390, 600, 820, 1024, 1280, 2560]) {
      const height = detectSsrViewportHeight(width);
      expect(Number.isInteger(height)).toBe(true);
      expect(height).toBeGreaterThan(0);
    }
  });

  it("scales with width inside a single orientation class", () => {
    expect(detectSsrViewportHeight(2560)).toBeGreaterThan(detectSsrViewportHeight(1280));
    expect(detectSsrViewportHeight(390)).toBeGreaterThan(detectSsrViewportHeight(320));
  });
});

describe("detectSsrViewportFromRequestScope", () => {
  it("falls back to the desktop default instead of throwing with no request scope", () => {
    // This is the client-bundle and static-export path: `requestHeaders()`
    // throws, and the guard must swallow it. A throw here would crash render.
    expect(() => detectSsrViewportFromRequestScope()).not.toThrow();
    expect(detectSsrViewportFromRequestScope()).toEqual({
      width: SSR_VIEWPORT.DESKTOP,
      height: detectSsrViewportHeight(SSR_VIEWPORT.DESKTOP),
    });
  });
});

describe("withSsrViewport", () => {
  it("adds the detected width to the wrapped loader's data", async () => {
    const loader = withSsrViewport(() => ({ foo: "bar" }));
    await expect(loader(requestWith({ cookie: "mrmeg-vw=1440" }), {})).resolves.toEqual({
      foo: "bar",
      ssrViewportWidth: 1440,
    });
  });

  it("awaits an async inner loader", async () => {
    const loader = withSsrViewport(async () => ({ foo: "bar" }));
    await expect(loader(requestWith({ "user-agent": IPHONE_UA }), {})).resolves.toEqual({
      foo: "bar",
      ssrViewportWidth: SSR_VIEWPORT.MOBILE,
    });
  });
});
