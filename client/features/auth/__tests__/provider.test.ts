/**
 * Tests for auth provider selection (`getAuthProvider`).
 *
 * This predicate is the single source of truth for which provider is active
 * — `isAuthEnabled`, `getAuthClient`, and the server bootstrap all key off
 * the same env contract. Regressions we care about:
 *   - blank env → auth disabled (the template stays explorable)
 *   - each provider activates on its own vars
 *   - Clerk wins ties unless EXPO_PUBLIC_AUTH_PROVIDER says otherwise
 *   - an explicit provider choice without its config fails closed (null)
 *
 * Scope note: `getAuthClient()`'s happy paths dynamic-import the provider
 * SDKs, which Jest's default babel transform can't resolve; the client
 * implementations are exercised in the running app.
 */

const ENV_KEYS = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_AUTH_PROVIDER",
] as const;

describe("getAuthProvider", () => {
  const original: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  beforeEach(() => {
    jest.resetModules();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  function subject(): "cognito" | "clerk" | null {
    const mod = require("../provider") as typeof import("../provider");
    return mod.getAuthProvider();
  }

  it("returns null with a blank env", () => {
    expect(subject()).toBeNull();
  });

  it("selects clerk when only the publishable key is set", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    expect(subject()).toBe("clerk");
  });

  it("selects cognito when both user-pool vars are set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    expect(subject()).toBe("cognito");
  });

  it("returns null when only one Cognito var is set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    expect(subject()).toBeNull();
  });

  it("prefers clerk when both providers are configured", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    expect(subject()).toBe("clerk");
  });

  it("honors EXPO_PUBLIC_AUTH_PROVIDER=cognito over the clerk default", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "cognito";
    expect(subject()).toBe("cognito");
  });

  it("fails closed when the explicit provider is not configured", () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "clerk";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    expect(subject()).toBeNull();
  });

  it("ignores whitespace-only values", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "   ";
    expect(subject()).toBeNull();
  });
});
