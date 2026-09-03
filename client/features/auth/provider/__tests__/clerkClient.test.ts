/**
 * Clerk client parity stubs.
 *
 * Email-code sign-in, social sign-in, and password-optional sign-up are
 * Cognito-only (the template's apps are migrating off Clerk), so `AuthClient`
 * grew three methods Clerk does not implement plus an optional `password` its
 * `signUp` still requires. All four must fail as a *normalized*
 * `AuthError("unsupported", …)` —
 * `AuthScreen` keys its copy off the code, so a raw throw would surface as
 * "Failed to sign in" instead of an explanation — and they must fail without
 * touching the Clerk SDK, since reaching them means the env is misconfigured,
 * not that a session is pending.
 *
 * The SDK modules are mocked so this file never loads `@clerk/*`; see
 * AuthProviderGate.test.tsx for why that matters to the web bundle.
 */

jest.mock("@clerk/clerk-expo", () => ({ getClerkInstance: jest.fn() }));
jest.mock("../ClerkProviderBoundary", () => ({ __esModule: true, default: () => null }));

import { getClerkInstance } from "@clerk/clerk-expo";
import { createClerkAuthClient } from "../clerkClient";
import { AuthError, isAuthError } from "../types";

const mockGetClerkInstance = getClerkInstance as jest.MockedFunction<typeof getClerkInstance>;

describe("createClerkAuthClient — unsupported flows", () => {
  beforeEach(() => {
    mockGetClerkInstance.mockReset();
  });

  it("rejects email-code sign-in as unsupported", async () => {
    const client = createClerkAuthClient();

    const error = await client
      .signInWithEmailCode({ email: "ada@example.com" })
      .catch((err) => err as unknown);

    expect(isAuthError(error)).toBe(true);
    expect((error as AuthError).code).toBe("unsupported");
  });

  it("rejects sign-in code confirmation as unsupported", async () => {
    const client = createClerkAuthClient();

    await expect(client.confirmSignInCode({ code: "123456" })).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("rejects social sign-in as unsupported", async () => {
    const client = createClerkAuthClient();

    await expect(client.signInWithProvider("google")).rejects.toMatchObject({
      code: "unsupported",
    });
    await expect(client.signInWithProvider("apple")).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("rejects a sign-up without a password as unsupported", async () => {
    const client = createClerkAuthClient();

    const error = await client
      .signUp({ email: "ada@example.com" })
      .catch((err) => err as unknown);

    expect(isAuthError(error)).toBe(true);
    expect((error as AuthError).code).toBe("unsupported");
    expect((error as AuthError).message).toContain("password");
  });

  it("points the operator at the provider switch", async () => {
    const client = createClerkAuthClient();

    const error: unknown = await client.signInWithProvider("google").catch((err) => err);

    expect((error as AuthError).message).toContain("EXPO_PUBLIC_AUTH_PROVIDER");
  });

  it("never reaches for the Clerk singleton", async () => {
    const client = createClerkAuthClient();

    await Promise.allSettled([
      client.signInWithEmailCode({ email: "ada@example.com" }),
      client.confirmSignInCode({ code: "123456" }),
      client.signInWithProvider("google"),
      client.signUp({ email: "ada@example.com" }),
    ]);

    expect(mockGetClerkInstance).not.toHaveBeenCalled();
  });
});
