/**
 * Tests for ensureAmplifyConfigured().
 *
 * The shell calls this exactly once during startup. Regressions we care
 * about:
 *   - auth-disabled development behavior when env vars are missing (no
 *     throw, warning only — the template stays explorable without a real
 *     Cognito pool)
 *   - production throw when env vars are missing (fail fast so a misdeploy
 *     doesn't quietly ship with broken auth)
 *   - idempotency (the Hub listener registration in authStore relies on
 *     ensureAmplifyConfigured staying a one-shot so it can't log on every
 *     event)
 *
 * Scope note: the happy-path branch uses `await import("aws-amplify")`
 * which Jest's default babel transform does not rewrite to a require —
 * testing that branch would require introducing a dynamic-import babel
 * plugin. The caller (authStore.initAuth) is exercised in the app; what we
 * pin down here is the env-validation contract that runs before the
 * dynamic import.
 */

describe("ensureAmplifyConfigured", () => {
  const originalPool = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const originalClient = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalPool === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_ID = originalPool;
    if (originalClient === undefined)
      delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = originalClient;
    warnSpy.mockRestore();
  });

  it("warns but does not throw in development when env is missing", async () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

    const mod = require("../config");
    await expect(mod.ensureAmplifyConfigured()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warning = String(warnSpy.mock.calls[0][0]);
    expect(warning).toContain("EXPO_PUBLIC_USER_POOL_ID");
    expect(warning).toContain("EXPO_PUBLIC_USER_POOL_CLIENT_ID");
  });

  it("throws in production when env is missing", async () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

    const mod = require("../config");
    await expect(mod.ensureAmplifyConfigured()).rejects.toThrow(
      /Auth configuration failed/
    );

    // Restore DEV flag for subsequent tests in this file
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
  });

  it("only lists the missing var when one is present", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

    const mod = require("../config");
    await expect(mod.ensureAmplifyConfigured()).rejects.toThrow(
      /EXPO_PUBLIC_USER_POOL_CLIENT_ID/
    );

    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
  });

  it("is idempotent in the warn branch — warns only on the first call", async () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

    const mod = require("../config");
    await mod.ensureAmplifyConfigured();
    await mod.ensureAmplifyConfigured();
    await mod.ensureAmplifyConfigured();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("resets on module reload so each test gets a clean slate", async () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

    // First module load — warn fires.
    const firstMod = require("../config");
    await firstMod.ensureAmplifyConfigured();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Reset modules — previously memoized `configured` flag is gone.
    jest.resetModules();
    warnSpy.mockClear();
    const secondMod = require("../config");
    await secondMod.ensureAmplifyConfigured();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
