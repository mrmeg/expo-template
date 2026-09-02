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
  "EXPO_PUBLIC_COGNITO_DOMAIN",
  "EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS",
] as const;

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

function provider() {
  return require("../provider") as typeof import("../provider");
}

describe("getAuthProvider", () => {
  function subject(): "cognito" | "clerk" | null {
    return provider().getAuthProvider();
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

/**
 * Social buttons are the one auth surface whose prerequisites are entirely
 * AWS-side (a Managed Login domain plus registered IdPs), so the env list is
 * treated as a claim that they exist. Everything here is about failing closed:
 * a rendered button that Cognito rejects is worse than no button.
 */
describe("getSocialAuthProviders", () => {
  function cognitoEnv() {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
  }

  function subject() {
    return provider().getSocialAuthProviders();
  }

  it("returns nothing with a blank env", () => {
    expect(subject()).toEqual([]);
  });

  it("returns the requested providers when Cognito and the domain are configured", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "example.auth.us-east-1.amazoncognito.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google,apple";

    expect(subject()).toEqual(["google", "apple"]);
  });

  it("tolerates spacing and casing, and keeps a stable order", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "auth.example.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = " Apple , GOOGLE ";

    expect(subject()).toEqual(["google", "apple"]);
  });

  it("honors a single provider", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "auth.example.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google";

    expect(subject()).toEqual(["google"]);
  });

  it("drops unsupported entries instead of rendering a dead button", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "auth.example.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google,github,facebook";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(subject()).toEqual(["google"]);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("hides the buttons without a Managed Login domain, and says why", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google,apple";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(subject()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EXPO_PUBLIC_COGNITO_DOMAIN"));

    warn.mockRestore();
  });

  it("hides the buttons on the Clerk path, which reports unsupported", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "auth.example.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google,apple";

    expect(subject()).toEqual([]);
  });

  it("hides the buttons when auth itself is disabled", () => {
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "auth.example.com";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google,apple";

    expect(subject()).toEqual([]);
  });

  it("ignores whitespace-only values", () => {
    cognitoEnv();
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "   ";
    process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS = "google";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(subject()).toEqual([]);

    warn.mockRestore();
  });

  it("stays quiet when nothing was requested", () => {
    cognitoEnv();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(subject()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
