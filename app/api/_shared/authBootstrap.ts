/**
 * Server bootstrap for the process-wide Cognito token verifier.
 *
 * When Cognito env vars are present, wires `createCognitoTokenVerifier`
 * into `setTokenVerifier`. When they are absent, leaves the registry
 * unset — `requireAuthenticatedUser` then fails closed with 401 rather
 * than accepting unverified tokens.
 *
 * The bootstrap is idempotent and lazy: every protected API route calls
 * `ensureAuthBootstrapped()` before running auth, so JWKs fetching is
 * deferred until the first real request.
 */

import { getTokenVerifier, setTokenVerifier, type TokenVerifier } from "./auth";
import { createCognitoTokenVerifier } from "./cognitoTokenVerifier";

let bootstrapped = false;

export function resetAuthBootstrap(): void {
  bootstrapped = false;
  setTokenVerifier(null);
}

export function ensureAuthBootstrapped(
  env: NodeJS.ProcessEnv = process.env,
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

  const userPoolId = nonEmpty(env.EXPO_PUBLIC_USER_POOL_ID);
  const clientId = nonEmpty(env.EXPO_PUBLIC_USER_POOL_CLIENT_ID);
  if (!userPoolId || !clientId) {
    // Leave the verifier null. `requireAuthenticatedUser` fails closed.
    return null;
  }

  const verifier = createCognitoTokenVerifier({ userPoolId, clientId });
  setTokenVerifier(verifier);
  return verifier;
}

function nonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
