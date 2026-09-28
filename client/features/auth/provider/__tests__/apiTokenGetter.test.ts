/**
 * `registerApiTokenGetter` is how the API client learns about auth without
 * importing it (the client-side mirror of the server's `setTokenVerifier`).
 * With auth disabled it must leave requests unauthenticated without ever
 * loading a provider SDK; with a provider configured, the token comes from the
 * active `AuthClient`.
 */
import { getAuthData, setAuthTokenGetter } from "@/client/lib/api/authenticatedFetch";

const mockGetAuthClient = jest.fn();

jest.mock("../index", () => ({
  ...jest.requireActual("../index"),
  getAuthClient: () => mockGetAuthClient(),
}));

import { registerApiTokenGetter } from "../apiTokenGetter";

const ENV_KEYS = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_AUTH_PROVIDER",
] as const;

describe("registerApiTokenGetter", () => {
  const original: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    mockGetAuthClient.mockReset();
  });

  afterEach(() => {
    setAuthTokenGetter(null);
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("leaves requests unauthenticated when auth is disabled", async () => {
    setAuthTokenGetter(async () => "stale");

    registerApiTokenGetter();

    await expect(getAuthData()).resolves.toEqual({ token: undefined });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("reads the token from the active auth client when a provider is configured", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    mockGetAuthClient.mockResolvedValue({ getToken: async () => "cognito-token" });

    registerApiTokenGetter();

    await expect(getAuthData()).resolves.toEqual({ token: "cognito-token" });
  });

  it("sends no token while the configured provider has no session", async () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    mockGetAuthClient.mockResolvedValue({ getToken: async () => null });

    registerApiTokenGetter();

    await expect(getAuthData()).resolves.toEqual({ token: undefined });
  });
});
