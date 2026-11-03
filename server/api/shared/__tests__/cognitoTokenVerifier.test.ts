/**
 * @jest-environment node
 */

/**
 * Claim mapping of the Cognito `TokenVerifier`, exercised through the real
 * `aws-jwt-verify`: tokens are RS256-signed here and the SDK verifies them for
 * real. The only seam is where the SDK would fetch keys over the network: the
 * verifier gets its JWKS cached up front, so signature, issuer, client, token
 * use, and expiry checks all run before the mapping sees a payload.
 */

import { createCognitoTokenVerifier } from "../cognitoTokenVerifier";
import { now, rsaKeyPair, signJwt, type KeyPair } from "./jwtTestHelpers";

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

const USER_POOL_ID = "us-east-1_TestPool1";
const CLIENT_ID = "test-app-client-id";
const COGNITO_ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;
const COGNITO_KID = "cognito-test-key";

let cognitoKeys: KeyPair;
let strangerKeys: KeyPair;

beforeAll(() => {
  cognitoKeys = rsaKeyPair();
  strangerKeys = rsaKeyPair();

  mockKeys.cognitoJwks = {
    keys: [{ ...cognitoKeys.publicKey.export({ format: "jwk" }), kid: COGNITO_KID, alg: "RS256", use: "sig" }],
  };
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
