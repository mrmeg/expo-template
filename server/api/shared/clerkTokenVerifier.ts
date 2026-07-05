/**
 * Clerk-backed `TokenVerifier` implementation.
 *
 * Wraps `@clerk/backend`'s `verifyToken` so the helper in `auth.ts` stays a
 * pure interface with no Clerk dependency. The SDK resolves and caches the
 * instance's JWKs internally, keyed by the secret key.
 *
 * The verifier expects a Clerk session token (what the Expo SDK's
 * `session.getToken()` returns). Standard session-token claims carry the
 * user id in `sub`; email is present only when the JWT template includes it.
 */

import type { AuthenticatedUser, TokenVerifier } from "./auth";

export interface ClerkTokenVerifierOptions {
  secretKey: string;
}

export function createClerkTokenVerifier(
  options: ClerkTokenVerifierOptions,
): TokenVerifier {
  return {
    async verify(token) {
      const { verifyToken } = await import("@clerk/backend");
      const payload = await verifyToken(token, { secretKey: options.secretKey });
      return toAuthenticatedUser(payload as unknown as Record<string, unknown>);
    },
  };
}

function toAuthenticatedUser(payload: Record<string, unknown>): AuthenticatedUser {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) {
    throw new Error("Clerk token payload missing 'sub'");
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  const username =
    typeof payload.username === "string" ? payload.username : null;

  return { userId: sub, email, username, claims: payload };
}
