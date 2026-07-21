/**
 * Server bootstrap for the process-wide token verifier.
 *
 * Selects the auth provider from env, mirroring the client's
 * `getAuthProvider()` (client/features/auth/provider):
 *   - `CLERK_SECRET_KEY` set                → Clerk verifier
 *   - both Cognito user-pool vars set       → Cognito verifier
 *   - neither                               → registry stays unset and
 *     `requireAuthenticatedUser` fails closed with 401 rather than
 *     accepting unverified tokens.
 * When both are configured, `EXPO_PUBLIC_AUTH_PROVIDER` disambiguates
 * (Clerk wins without it).
 *
 * The bootstrap is idempotent and lazy: every protected API route calls
 * `ensureAuthBootstrapped()` before running auth, so JWKs fetching is
 * deferred until the first real request.
 */

import { getTokenVerifier, setTokenVerifier, type TokenVerifier } from "./auth";
import { createClerkTokenVerifier } from "./clerkTokenVerifier";
import { createCognitoTokenVerifier } from "./cognitoTokenVerifier";

let bootstrapped = false;

export function resetAuthBootstrap(): void {
  bootstrapped = false;
  setTokenVerifier(null);
}

export function ensureAuthBootstrapped(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): TokenVerifier | null {
  if (bootstrapped) return getTokenVerifier();

  // Don't overwrite a verifier that's already been installed (tests,
  // or a deployment hook that wires a custom verifier).
  const preinstalled = getTokenVerifier();
  if (preinstalled) {
    bootstrapped = true;
    return preinstalled;
  }

  bootstrapped = true;

  const clerkSecretKey = nonEmpty(env.CLERK_SECRET_KEY);
  const userPoolId = nonEmpty(env.EXPO_PUBLIC_USER_POOL_ID);
  const clientId = nonEmpty(env.EXPO_PUBLIC_USER_POOL_CLIENT_ID);
  const explicit = nonEmpty(env.EXPO_PUBLIC_AUTH_PROVIDER);

  const clerkConfigured = clerkSecretKey !== null;
  const cognitoConfigured = userPoolId !== null && clientId !== null;

  let provider: "clerk" | "cognito" | null;
  if (explicit === "clerk") provider = clerkConfigured ? "clerk" : null;
  else if (explicit === "cognito") provider = cognitoConfigured ? "cognito" : null;
  else if (clerkConfigured) provider = "clerk";
  else if (cognitoConfigured) provider = "cognito";
  else provider = null;

  if (provider === "clerk") {
    const verifier = createClerkTokenVerifier({ secretKey: clerkSecretKey! });
    setTokenVerifier(verifier);
    return verifier;
  }

  if (provider === "cognito") {
    const verifier = createCognitoTokenVerifier({
      userPoolId: userPoolId!,
      clientId: clientId!,
    });
    setTokenVerifier(verifier);
    return verifier;
  }

  // Leave the verifier null. `requireAuthenticatedUser` fails closed.
  return null;
}

function nonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
