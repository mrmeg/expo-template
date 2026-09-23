/**
 * @jest-environment node
 */

/**
 * Claim mapping of the Clerk and Cognito `TokenVerifier`s, exercised
 * through the real libraries: tokens are RS256-signed here, and each SDK
 * verifies them for real. The only seam is where the SDK would fetch keys
 * over the network — Cognito's verifier gets its JWKS cached up front, and
 * Clerk's `verifyToken` gets the matching PEM as `jwtKey` — so signature,
 * issuer, audience, and expiry checks all run before the mapping sees a
 * payload.
 */

import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import * as clerkBackend from "@clerk/backend";

import { createClerkTokenVerifier } from "../clerkTokenVerifier";
import { createCognitoTokenVerifier } from "../cognitoTokenVerifier";

type KeyPair = { publicKey: KeyObject; privateKey: KeyObject };

const mockKeys: { cognitoJwks?: unknown } = {};

jest.mock("aws-jwt-verify", () => {
  const actual = jest.requireActual("aws-jwt-verify");
  return {
    ...actual,
    CognitoJwtVerifier: {
      create: (...args: unknown[]) => {
        const verifier = actual.CognitoJwtVerifier.create(...args);
        verifier.cacheJwks(mockKeys.cognitoJwks);
        return verifier;
      },
    },
  };
});

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

const USER_POOL_ID = "us-east-1_TestPool1";
const CLIENT_ID = "test-app-client-id";
const COGNITO_ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;
const COGNITO_KID = "cognito-test-key";

function rsaKeyPair(): KeyPair {
  return generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function signJwt(privateKey: KeyObject, header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey);
  return `${input}.${base64url(signature)}`;
}

const now = () => Math.floor(Date.now() / 1000);

let cognitoKeys: KeyPair;
let clerkKeys: KeyPair;
let strangerKeys: KeyPair;

beforeAll(() => {
  cognitoKeys = rsaKeyPair();
  clerkKeys = rsaKeyPair();
  strangerKeys = rsaKeyPair();

  mockKeys.cognitoJwks = {
    keys: [{ ...cognitoKeys.publicKey.export({ format: "jwk" }), kid: COGNITO_KID, alg: "RS256", use: "sig" }],
  };
  clerkPem = clerkKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
});

describe("createCognitoTokenVerifier", () => {
  function cognitoToken(payload: Record<string, unknown>, privateKey = cognitoKeys.privateKey): string {
    return signJwt(privateKey, { alg: "RS256", kid: COGNITO_KID }, {
      iss: COGNITO_ISSUER,
      iat: now(),
      exp: now() + 3_600,
      ...payload,
    });
  }

  it("maps an access token: sub → userId, username, no email, full claims", async () => {
    const verifier = createCognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID });
    const token = cognitoToken({
      sub: "0f7c3d1e-sub",
      token_use: "access",
      client_id: CLIENT_ID,
      username: "ada",
      scope: "aws.cognito.signin.user.admin",
    });

    const user = await verifier.verify(token);
    expect(user).toEqual({
      userId: "0f7c3d1e-sub",
      email: null,
      username: "ada",
      claims: expect.objectContaining({ sub: "0f7c3d1e-sub", client_id: CLIENT_ID, token_use: "access" }),
    });
  });

  it("maps an id token: email, and cognito:username over username", async () => {
    const verifier = createCognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, tokenUse: "id" });
    const token = cognitoToken({
      sub: "0f7c3d1e-sub",
      token_use: "id",
      aud: CLIENT_ID,
      email: "ada@example.com",
      "cognito:username": "ada-cognito",
      username: "ada-plain",
    });

    await expect(verifier.verify(token)).resolves.toMatchObject({
      userId: "0f7c3d1e-sub",
      email: "ada@example.com",
      username: "ada-cognito",
    });
  });

  it("maps non-string claims to null", async () => {
    const verifier = createCognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID });
    const token = cognitoToken({
      sub: "0f7c3d1e-sub",
      token_use: "access",
      client_id: CLIENT_ID,
      email: { address: "ada@example.com" },
      username: 42,
    });

    await expect(verifier.verify(token)).resolves.toMatchObject({ email: null, username: null });
  });

  it("rejects a token without a subject", async () => {
    const verifier = createCognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID });
    const token = cognitoToken({ token_use: "access", client_id: CLIENT_ID, username: "ada" });
    await expect(verifier.verify(token)).rejects.toThrow("missing 'sub'");
  });

  it("fails closed on another app client, the wrong token use, expiry, or a foreign key", async () => {
    const verifier = createCognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID });
    const base = { sub: "0f7c3d1e-sub", token_use: "access", client_id: CLIENT_ID };

    await expect(verifier.verify(cognitoToken({ ...base, client_id: "someone-else" }))).rejects.toThrow();
    await expect(verifier.verify(cognitoToken({ ...base, token_use: "id" }))).rejects.toThrow();
    await expect(verifier.verify(cognitoToken({ ...base, exp: now() - 60 }))).rejects.toThrow();
    await expect(verifier.verify(cognitoToken(base, strangerKeys.privateKey))).rejects.toThrow();
  });
});

describe("createClerkTokenVerifier", () => {
  function clerkToken(payload: Record<string, unknown>, privateKey = clerkKeys.privateKey): string {
    return signJwt(privateKey, { alg: "RS256", typ: "JWT", kid: "ins_test" }, {
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
