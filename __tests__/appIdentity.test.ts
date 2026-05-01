/**
 * Tests for the shared app-identity module that backs `app.config.ts` and
 * `client/lib/identity.ts`.
 *
 * Pins:
 *   - empty / unset env values fall back to template defaults
 *   - whitespace-only overrides are treated as missing
 *   - valid overrides land in the resolved identity
 *   - malformed overrides throw immediately (so a typo can't ship a bad
 *     native build ID or deep-link scheme)
 *   - `buildDeepLink` normalizes the leading slash on the path
 */

import {
  APP_IDENTITY_DEFAULTS,
  buildDeepLink,
  getAppIdentity,
} from "../app.identity";

describe("getAppIdentity", () => {
  it("returns defaults when no env overrides are set", () => {
    expect(getAppIdentity({})).toEqual(APP_IDENTITY_DEFAULTS);
  });

  it("returns defaults when overrides are empty or whitespace-only", () => {
    expect(
      getAppIdentity({
        EXPO_PUBLIC_APP_NAME: "",
        EXPO_PUBLIC_APP_SLUG: "",
        EXPO_PUBLIC_APP_SCHEME: "   ",
        EXPO_PUBLIC_APP_IOS_BUNDLE_ID: "",
        EXPO_PUBLIC_APP_ANDROID_PACKAGE: "  \n  ",
      }),
    ).toEqual(APP_IDENTITY_DEFAULTS);
  });

  it("applies valid env overrides per field", () => {
    const id = getAppIdentity({
      EXPO_PUBLIC_APP_NAME: "Acme",
      EXPO_PUBLIC_APP_SLUG: "acme-app",
      EXPO_PUBLIC_APP_SCHEME: "acme",
      EXPO_PUBLIC_APP_IOS_BUNDLE_ID: "com.acme.app",
      EXPO_PUBLIC_APP_ANDROID_PACKAGE: "com.acme.app",
    });
    expect(id).toEqual({
      name: "Acme",
      slug: "acme-app",
      scheme: "acme",
      iosBundleIdentifier: "com.acme.app",
      androidPackage: "com.acme.app",
    });
  });

  it("trims whitespace around valid overrides", () => {
    expect(getAppIdentity({ EXPO_PUBLIC_APP_SCHEME: "  acme  " }).scheme).toBe("acme");
  });

  it("throws on a malformed scheme so a typo can't ship to native", () => {
    expect(() =>
      getAppIdentity({ EXPO_PUBLIC_APP_SCHEME: "Has Spaces" }),
    ).toThrow(/scheme/i);
    expect(() =>
      getAppIdentity({ EXPO_PUBLIC_APP_SCHEME: "9starts-with-digit" }),
    ).toThrow(/scheme/i);
  });

  it("throws on a malformed iOS bundle identifier", () => {
    expect(() =>
      getAppIdentity({ EXPO_PUBLIC_APP_IOS_BUNDLE_ID: "no-dots-here" }),
    ).toThrow(/iosBundleIdentifier/);
  });

  it("throws on a malformed Android package", () => {
    expect(() =>
      getAppIdentity({ EXPO_PUBLIC_APP_ANDROID_PACKAGE: "lowercase only no dots" }),
    ).toThrow(/androidPackage/);
  });

  it("throws on a malformed slug", () => {
    expect(() => getAppIdentity({ EXPO_PUBLIC_APP_SLUG: "Has Capitals" })).toThrow(/slug/i);
  });

  it("accepts arbitrary display name characters (no validation)", () => {
    expect(getAppIdentity({ EXPO_PUBLIC_APP_NAME: "Acme — Pro!" }).name).toBe("Acme — Pro!");
  });
});

describe("buildDeepLink", () => {
  it("joins scheme and path with `://`", () => {
    expect(buildDeepLink("acme", "billing/return")).toBe("acme://billing/return");
  });

  it("strips a leading slash on the path so callers can pass either form", () => {
    expect(buildDeepLink("acme", "/billing/return")).toBe("acme://billing/return");
  });

  it("preserves query strings and fragments", () => {
    expect(buildDeepLink("acme", "/billing/return?status=success")).toBe(
      "acme://billing/return?status=success",
    );
  });
});
