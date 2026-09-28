/**
 * Tests for validateClientEnv() — pin the template's optional-feature contract.
 *
 * Auth (Cognito), the external API URL, and Stripe billing are all optional.
 * A fresh clone with no `.env` should produce zero warnings; partial Cognito
 * config or billing-enabled-without-app-url should warn clearly.
 */

const PUBLIC_KEYS = [
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_AUTH_PROVIDER",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_BILLING_ENABLED",
  "EXPO_PUBLIC_APP_URL",
] as const;

describe("validateClientEnv", () => {
  const originals: Partial<Record<(typeof PUBLIC_KEYS)[number], string | undefined>> = {};
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const key of PUBLIC_KEYS) originals[key] = process.env[key];
    for (const key of PUBLIC_KEYS) delete process.env[key];
    jest.resetModules();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of PUBLIC_KEYS) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key]!;
    }
    warnSpy.mockRestore();
  });

  function load(): { validateClientEnv: () => void } {
    return require("../validateEnv");
  }

  it("does not warn when no optional features are configured (template default)", () => {
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when both Cognito vars are set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when only EXPO_PUBLIC_USER_POOL_ID is set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain("Partial Cognito");
    expect(message).toContain("EXPO_PUBLIC_USER_POOL_CLIENT_ID");
  });

  it("warns when only EXPO_PUBLIC_USER_POOL_CLIENT_ID is set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain("Partial Cognito");
    expect(message).toContain("EXPO_PUBLIC_USER_POOL_ID");
  });

  it("treats whitespace-only Cognito values as missing", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "   ";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("EXPO_PUBLIC_USER_POOL_ID");
  });

  it("does not warn about a missing API URL", () => {
    // Web uses the same-origin Expo Router api routes and native development
    // the dev server; only a native release build with billing needs
    // EXPO_PUBLIC_API_URL (covered below).
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
    // Even with auth fully configured, missing API_URL is silent.
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    jest.resetModules();
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when billing is enabled (\"true\") and APP_URL is empty", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain("EXPO_PUBLIC_BILLING_ENABLED");
    expect(message).toContain("EXPO_PUBLIC_APP_URL");
  });

  it("warns when billing is enabled (\"1\") and APP_URL is empty", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "1";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("EXPO_PUBLIC_APP_URL");
  });

  it("warns when billing is enabled regardless of case", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "TRUE";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("treats whitespace-only APP_URL as missing for the billing warning", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
    process.env.EXPO_PUBLIC_APP_URL = "   ";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("EXPO_PUBLIC_APP_URL");
  });

  it("does not warn when billing is enabled and APP_URL is set", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
    process.env.EXPO_PUBLIC_APP_URL = "https://example.com";
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  describe("native release builds", () => {
    const globalWithDev = globalThis as unknown as { __DEV__: boolean };
    const originalDev = globalWithDev.__DEV__;

    /**
     * Patch the `react-native` instance `load()` will see: the outer
     * `beforeEach` resets the module registry, so it has to be required here,
     * after the reset, rather than once at the top of the file.
     */
    function releaseBuildOn(os: "ios" | "web") {
      const { Platform } = require("react-native") as typeof import("react-native");
      Object.defineProperty(Platform, "OS", { value: os, configurable: true });
      globalWithDev.__DEV__ = false;
    }

    afterEach(() => {
      globalWithDev.__DEV__ = originalDev;
    });

    function apiOriginWarnings(): string[] {
      return warnSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.includes("EXPO_PUBLIC_API_URL"));
    }

    it("warns when billing is on but no API origin is configured", () => {
      releaseBuildOn("ios");
      process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
      process.env.EXPO_PUBLIC_APP_URL = "https://example.com";

      load().validateClientEnv();

      expect(apiOriginWarnings()).toHaveLength(1);
      expect(apiOriginWarnings()[0]).toContain("billing requests will fail");
    });

    it("stays quiet once EXPO_PUBLIC_API_URL is set", () => {
      releaseBuildOn("ios");
      process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
      process.env.EXPO_PUBLIC_APP_URL = "https://example.com";
      process.env.EXPO_PUBLIC_API_URL = "https://example.com";

      load().validateClientEnv();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("stays quiet on web, which calls the same-origin routes", () => {
      releaseBuildOn("web");
      process.env.EXPO_PUBLIC_BILLING_ENABLED = "true";
      process.env.EXPO_PUBLIC_APP_URL = "https://example.com";

      load().validateClientEnv();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("stays quiet with billing off", () => {
      releaseBuildOn("ios");

      load().validateClientEnv();

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it("does not warn when billing is disabled (\"false\") with empty APP_URL", () => {
    process.env.EXPO_PUBLIC_BILLING_ENABLED = "false";
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when only the Clerk publishable key is set", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when EXPO_PUBLIC_AUTH_PROVIDER=clerk but the publishable key is missing", () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "clerk";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
  });

  it("warns when EXPO_PUBLIC_AUTH_PROVIDER=cognito but the pool vars are incomplete", () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "cognito";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    load().validateClientEnv();
    // Partial-Cognito warning fires too; the explicit-provider one must be present.
    const messages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("EXPO_PUBLIC_AUTH_PROVIDER=cognito"))).toBe(true);
  });

  it("warns on an unknown EXPO_PUBLIC_AUTH_PROVIDER value", () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "auth0";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("auth0");
  });

  it("warns when both providers are configured without an explicit choice", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    load().validateClientEnv();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("defaulting to Cognito");
  });

  it("does not warn when both providers are configured and one is chosen explicitly", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client-id-abc";
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "cognito";
    load().validateClientEnv();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
