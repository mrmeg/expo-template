/**
 * Auth bootstrap tests.
 *
 * The real verifiers pull JWKs over the network, which we can't do offline,
 * so both factories are mocked to return distinguishable fakes. That lets
 * the tests assert *which* provider the env selected, not just that one was
 * installed. Also covered: the "no env vars → null" path, idempotency, and
 * the "honor preinstalled verifier" path used by unit tests and production
 * wiring hooks.
 */

import { getTokenVerifier, setTokenVerifier, type TokenVerifier } from "../auth";
import { ensureAuthBootstrapped, resetAuthBootstrap } from "../authBootstrap";
import { createClerkTokenVerifier } from "../clerkTokenVerifier";
import { createCognitoTokenVerifier } from "../cognitoTokenVerifier";

jest.mock("../clerkTokenVerifier", () => ({ createClerkTokenVerifier: jest.fn() }));
jest.mock("../cognitoTokenVerifier", () => ({ createCognitoTokenVerifier: jest.fn() }));

const fakeVerifier: TokenVerifier = {
  async verify() {
    return { userId: "u", email: null };
  },
};

const clerkVerifier: TokenVerifier = {
  async verify() {
    return { userId: "clerk-user", email: null };
  },
};

const cognitoVerifier: TokenVerifier = {
  async verify() {
    return { userId: "cognito-user", email: null };
  },
};

beforeEach(() => {
  resetAuthBootstrap();
  jest.mocked(createClerkTokenVerifier).mockClear().mockReturnValue(clerkVerifier);
  jest.mocked(createCognitoTokenVerifier).mockClear().mockReturnValue(cognitoVerifier);
});

afterEach(() => {
  resetAuthBootstrap();
});

describe("ensureAuthBootstrapped", () => {
  it("returns null when no provider env vars are set", () => {
    expect(ensureAuthBootstrapped({})).toBeNull();
    expect(getTokenVerifier()).toBeNull();
  });

  it("installs a verifier when Clerk env is present", () => {
    const result = ensureAuthBootstrapped({ CLERK_SECRET_KEY: "sk_test_xxx" });
    expect(result).not.toBeNull();
    expect(getTokenVerifier()).toBe(result);
  });

  it("installs a verifier when Cognito env is present", () => {
    const result = ensureAuthBootstrapped({
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
    });
    expect(result).not.toBeNull();
    expect(getTokenVerifier()).toBe(result);
  });

  it("prefers cognito when both providers are set without an explicit choice", () => {
    const result = ensureAuthBootstrapped({
      CLERK_SECRET_KEY: "sk_test_xxx",
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
    });
    expect(result).toBe(cognitoVerifier);
    expect(createClerkTokenVerifier).not.toHaveBeenCalled();
  });

  it("honors EXPO_PUBLIC_AUTH_PROVIDER=clerk over the cognito default", () => {
    const result = ensureAuthBootstrapped({
      CLERK_SECRET_KEY: "sk_test_xxx",
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
      EXPO_PUBLIC_AUTH_PROVIDER: "clerk",
    });
    expect(result).toBe(clerkVerifier);
    expect(createCognitoTokenVerifier).not.toHaveBeenCalled();
  });

  it("honors EXPO_PUBLIC_AUTH_PROVIDER=cognito when both providers are set", () => {
    // Distinguish the branches without hitting the network: an explicit
    // "cognito" choice with incomplete Cognito env must NOT fall back to
    // the fully-configured Clerk path.
    const result = ensureAuthBootstrapped({
      CLERK_SECRET_KEY: "sk_test_xxx",
      EXPO_PUBLIC_AUTH_PROVIDER: "cognito",
    });
    expect(result).toBeNull();
    expect(getTokenVerifier()).toBeNull();
  });

  it("returns null when EXPO_PUBLIC_AUTH_PROVIDER=clerk but the secret key is missing", () => {
    const result = ensureAuthBootstrapped({
      EXPO_PUBLIC_AUTH_PROVIDER: "clerk",
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
    });
    expect(result).toBeNull();
    expect(getTokenVerifier()).toBeNull();
  });

  it("preserves a preinstalled verifier instead of overwriting it", () => {
    setTokenVerifier(fakeVerifier);

    const result = ensureAuthBootstrapped({
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
    });

    expect(result).toBe(fakeVerifier);
    expect(getTokenVerifier()).toBe(fakeVerifier);
  });

  it("is idempotent — only reads env on the first call", () => {
    // First call with no env → null.
    ensureAuthBootstrapped({});
    // Second call with complete env must short-circuit to the same null.
    const result = ensureAuthBootstrapped({
      EXPO_PUBLIC_USER_POOL_ID: "us-east-1_xxx",
      EXPO_PUBLIC_USER_POOL_CLIENT_ID: "client123",
    });
    expect(result).toBeNull();
    expect(getTokenVerifier()).toBeNull();
  });

  it("resetAuthBootstrap clears both the flag and the verifier", () => {
    setTokenVerifier(fakeVerifier);
    ensureAuthBootstrapped({});
    expect(getTokenVerifier()).toBe(fakeVerifier);

    resetAuthBootstrap();

    expect(getTokenVerifier()).toBeNull();
  });
});
