/**
 * The route-identity discriminator that lets a screen render less than the
 * server did.
 *
 * These cases exist because the module they cover replaced a broken one: the
 * first version keyed off "has React committed once?", which a leaf screen can
 * observe as `true` while it is still hydrating (React hydrates selectively, so
 * the root layout's effects can fire before a leaf's render). The invariant to
 * protect is that the hydration render of the entry route is indistinguishable
 * from the server render — no effect ordering involved.
 *
 * `test/setup.ts` resets the module before every test.
 */

import {
  __getClientNavigationStateForTests,
  isClientNavigatedScreen,
  recordPathname,
} from "../clientNavigation";

/** Runs `fn` with no global `window`, the way a server render sees it. */
function asServerRender<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  delete (globalThis as { window?: unknown }).window;
  try {
    return fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
  }
}

describe("recordPathname", () => {
  it("seeds the entry pathname on the first call", () => {
    recordPathname("/components");

    expect(__getClientNavigationStateForTests()).toEqual({
      initialPathname: "/components",
      hasNavigated: false,
    });
  });

  it("is idempotent, so calling it every render is safe", () => {
    recordPathname("/components");
    recordPathname("/components");
    recordPathname("/components");

    expect(__getClientNavigationStateForTests()).toEqual({
      initialPathname: "/components",
      hasNavigated: false,
    });
  });

  it("latches hasNavigated once the app moves, and never unlatches", () => {
    recordPathname("/components");
    recordPathname("/blocks");
    expect(__getClientNavigationStateForTests().hasNavigated).toBe(true);

    // Back on the entry route — the latch has to stay set, because the entry
    // HTML this load started with is long gone.
    recordPathname("/components");
    expect(__getClientNavigationStateForTests()).toEqual({
      initialPathname: "/components",
      hasNavigated: true,
    });
  });

  it("ignores values that aren't a usable pathname", () => {
    recordPathname(undefined);
    recordPathname(null);
    recordPathname("");

    expect(__getClientNavigationStateForTests().initialPathname).toBeNull();
  });
});

describe("isClientNavigatedScreen", () => {
  it("is false for the entry route — the hydration render must match the HTML", () => {
    recordPathname("/components");

    expect(isClientNavigatedScreen("/components")).toBe(false);
  });

  it("is true for a route the app navigated to", () => {
    recordPathname("/components");

    expect(isClientNavigatedScreen("/blocks")).toBe(true);
  });

  it("is true back on the entry route once a navigation has happened", () => {
    recordPathname("/components");
    recordPathname("/blocks");

    expect(isClientNavigatedScreen("/components")).toBe(true);
  });

  it("is false before any pathname is recorded", () => {
    expect(isClientNavigatedScreen("/components")).toBe(false);
  });

  it("is false for an unusable pathname, even after an entry is recorded", () => {
    recordPathname("/components");

    expect(isClientNavigatedScreen(undefined)).toBe(false);
    expect(isClientNavigatedScreen("")).toBe(false);
  });

  it("is false on the server no matter what the module recorded", () => {
    // A server process is long-lived: `initialPathname` there belongs to
    // whichever request arrived first, so it can never be trusted. SSR HTML must
    // always be complete.
    recordPathname("/components");
    recordPathname("/blocks");

    expect(asServerRender(() => isClientNavigatedScreen("/blocks"))).toBe(false);
    expect(asServerRender(() => isClientNavigatedScreen("/anything"))).toBe(false);
  });
});
