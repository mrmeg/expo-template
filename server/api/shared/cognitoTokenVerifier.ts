/**
 * Cognito-backed `TokenVerifier` implementation.
 *
 * Wraps `aws-jwt-verify` so the helper in `auth.ts` stays a pure
 * interface with no AWS dependency. Adopters who use a different
 * identity provider replace only this file.
 *
 * The verifier expects an access token (the one Amplify's
 * `fetchAuthSession` returns as `accessToken.toString()`); the Cognito
 * JWKs endpoint it pulls keys from is derived from the user pool id
 * and region.
 */

import { CognitoJwtVerifier } from "aws-jwt-verify";

import type { AuthenticatedUser, TokenVerifier } from "./auth";

export interface CognitoTokenVerifierOptions {
  userPoolId: string;
  clientId: string;
  /** `"access"` (default) or `"id"`. Access tokens don't include email. */
  tokenUse?: "access" | "id";
}

export function createCognitoTokenVerifier(
  options: CognitoTokenVerifierOptions,
): TokenVerifier {
  const tokenUse = options.tokenUse ?? "access";
  const inner = CognitoJwtVerifier.create({
    userPoolId: options.userPoolId,
    clientId: options.clientId,
    tokenUse,
  });

  return {
    async verify(token) {
      const payload = await inner.verify(token);
      return toAuthenticatedUser(payload);
    },
  };
}

function toAuthenticatedUser(payload: Record<string, unknown>): AuthenticatedUser {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) {
    throw new Error("Cognito token payload missing 'sub'");
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  const username =
    typeof payload["cognito:username"] === "string"
      ? (payload["cognito:username"] as string)
      : typeof payload.username === "string"
        ? (payload.username as string)
        : null;

  return { userId: sub, email, username, claims: payload };
}
