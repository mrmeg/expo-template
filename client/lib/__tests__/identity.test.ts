/**
 * Tests for the runtime identity accessors. Defaults match `app.identity.ts`,
 * env overrides flow through, and `buildAppDeepLink` normalizes the path.
 */

const ENV_KEYS = [
  "EXPO_PUBLIC_APP_SCHEME",
  "EXPO_PUBLIC_APP_NAME",
] as const;

describe("client/lib/identity", () => {
  const originals: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) originals[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
    jest.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k]!;
    }
  });

  function load() {
    return require("../identity");
  }

  it("returns the template-default scheme when EXPO_PUBLIC_APP_SCHEME is unset", () => {
    expect(load().getAppScheme()).toBe("myapp");
  });

  it("returns an env override for the scheme when present", () => {
    process.env.EXPO_PUBLIC_APP_SCHEME = "acme";
    expect(load().getAppScheme()).toBe("acme");
  });

  it("treats a whitespace-only scheme override as missing and falls back to the default", () => {
    process.env.EXPO_PUBLIC_APP_SCHEME = "   ";
    expect(load().getAppScheme()).toBe("myapp");
  });

  it("returns the template-default name when EXPO_PUBLIC_APP_NAME is unset", () => {
    expect(load().getAppName()).toBe("template");
  });

  it("buildAppDeepLink composes scheme + path", () => {
    process.env.EXPO_PUBLIC_APP_SCHEME = "acme";
    expect(load().buildAppDeepLink("/billing/return")).toBe("acme://billing/return");
    expect(load().buildAppDeepLink("billing/return")).toBe("acme://billing/return");
  });
});
