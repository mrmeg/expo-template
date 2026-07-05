/**
 * Auth bootstrap tests.
 *
 * The real verifier pulls Cognito JWKs over the network, which we
 * can't do offline. These tests cover the branches that don't: the
 * "no env vars → null" path, idempotency, and the "honor preinstalled
 * verifier" path used by unit tests and production wiring hooks.
 */

import { getTokenVerifier, setTokenVerifier, type TokenVerifier } from "../auth";
import { ensureAuthBootstrapped, resetAuthBootstrap } from "../authBootstrap";

const fakeVerifier: TokenVerifier = {
  async verify() {
    return { userId: "u", email: null };
  },
};

beforeEach(() => {
  resetAuthBootstrap();
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
