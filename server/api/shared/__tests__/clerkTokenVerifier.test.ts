/**
 * @jest-environment node
 */

/**
 * Claim mapping of the Clerk `TokenVerifier`, exercised through the real
 * `@clerk/backend`: tokens are RS256-signed here and `verifyToken` verifies
 * them for real. The only seam is where the SDK would fetch the instance's
 * JWKS: it gets the matching PEM as `jwtKey`, so signature and expiry checks
 * all run before the mapping sees a payload.
 */

import * as clerkBackend from "@clerk/backend";

import { createClerkTokenVerifier } from "../clerkTokenVerifier";
import { now, rsaKeyPair, signJwt, type KeyPair } from "./jwtTestHelpers";

let clerkPem: string;

/** The real `@clerk/backend`, verifying against the local key instead of fetching the instance's JWKS. */
function clerkVerifier() {
  return createClerkTokenVerifier({
    secretKey: "sk_test_unused",
    loadBackend: async () => ({
      verifyToken: ((token: string, options: Parameters<typeof clerkBackend.verifyToken>[1]) =>
        clerkBackend.verifyToken(token, { ...options, jwtKey: clerkPem })) as typeof clerkBackend.verifyToken,
    }),
  });
}

let clerkKeys: KeyPair;
let strangerKeys: KeyPair;

beforeAll(() => {
  clerkKeys = rsaKeyPair();
  strangerKeys = rsaKeyPair();
  clerkPem = clerkKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
});

describe("createClerkTokenVerifier", () => {
  function clerkToken(payload: Record<string, unknown>, privateKey = clerkKeys.privateKey): string {
    // `cat` is Clerk's session-token category; `@clerk/backend` 3.28 rejects a token without it.
    return signJwt(privateKey, { alg: "RS256", typ: "JWT", kid: "ins_test", cat: "cl_B7d4PD111AAA" }, {
      iss: "https://clerk.example.com",
      sid: "sess_123",
      iat: now() - 5,
      nbf: now() - 5,
      exp: now() + 60,
      ...payload,
    });
  }

  it("maps a session token: sub → userId, no email or username by default", async () => {
    const verifier = clerkVerifier();
    const user = await verifier.verify(clerkToken({ sub: "user_2abc" }));

    expect(user).toEqual({
      userId: "user_2abc",
      email: null,
      username: null,
      claims: expect.objectContaining({ sub: "user_2abc", sid: "sess_123" }),
    });
  });

  it("maps email and username when the JWT template adds them", async () => {
    const verifier = clerkVerifier();
    const token = clerkToken({ sub: "user_2abc", email: "ada@example.com", username: "ada" });

    await expect(verifier.verify(token)).resolves.toMatchObject({
      userId: "user_2abc",
      email: "ada@example.com",
      username: "ada",
    });
  });

  it("maps non-string claims to null", async () => {
    const verifier = clerkVerifier();
    const token = clerkToken({ sub: "user_2abc", email: ["ada@example.com"], username: { name: "ada" } });
    await expect(verifier.verify(token)).resolves.toMatchObject({ email: null, username: null });
  });

  it("fails closed on a missing subject, expiry, or a foreign key", async () => {
    const verifier = clerkVerifier();

    await expect(verifier.verify(clerkToken({}))).rejects.toThrow();
    await expect(verifier.verify(clerkToken({ sub: "user_2abc", exp: now() - 3_600 }))).rejects.toThrow();
    await expect(verifier.verify(clerkToken({ sub: "user_2abc" }, strangerKeys.privateKey))).rejects.toThrow();
  });
});
