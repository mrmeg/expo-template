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
  it("returns null when Cognito env vars are missing", () => {
    expect(ensureAuthBootstrapped({})).toBeNull();
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
