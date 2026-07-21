/**
 * Auth provider selection.
 *
 * The active provider is derived from env, mirroring the fail-closed policy
 * in `isAuthEnabled` and the server's `ensureAuthBootstrapped`:
 *   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` set          → Clerk
 *   - both Cognito user-pool vars set                  → Cognito
 *   - neither                                          → auth disabled (null)
 *
 * When both are configured, `EXPO_PUBLIC_AUTH_PROVIDER` ("clerk" | "cognito")
 * disambiguates; without it, Clerk wins and we warn once in dev.
 *
 * `getAuthClient()` lazily imports the selected implementation so the unused
 * SDK never enters the bundle path at runtime.
 */

import type { AuthClient, AuthProviderName } from "./types";

export type { AuthClient, AuthProviderName } from "./types";
export {
  AuthError,
  isAuthError,
  type AuthChangeEvent,
  type AuthErrorCode,
  type AuthFlowResult,
  type ConfirmSignUpResult,
  type ForgotPasswordResult,
} from "./types";

let warnedAmbiguous = false;

export function getAuthProvider(): AuthProviderName | null {
  // Static property access — Expo only inlines `process.env.EXPO_PUBLIC_*`
  // references that survive static analysis.
  const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const userPoolId = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const userPoolClientId = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
  const explicit = process.env.EXPO_PUBLIC_AUTH_PROVIDER;

  const clerkConfigured = isNonEmpty(clerkKey);
  const cognitoConfigured = isNonEmpty(userPoolId) && isNonEmpty(userPoolClientId);

  if (explicit === "clerk") return clerkConfigured ? "clerk" : null;
  if (explicit === "cognito") return cognitoConfigured ? "cognito" : null;

  if (clerkConfigured && cognitoConfigured && __DEV__ && !warnedAmbiguous) {
    warnedAmbiguous = true;
    console.warn(
      "⚠️ Both Clerk and Cognito env vars are set; defaulting to Clerk. Set EXPO_PUBLIC_AUTH_PROVIDER to choose explicitly.",
    );
  }

  if (clerkConfigured) return "clerk";
  if (cognitoConfigured) return "cognito";
  return null;
}

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

let clientPromise: Promise<AuthClient | null> | null = null;

/**
 * Resolve the active AuthClient singleton, or null when auth is disabled.
 * The provider module is imported lazily on first call.
 */
export function getAuthClient(): Promise<AuthClient | null> {
  if (!clientPromise) {
    clientPromise = loadClient();
  }
  return clientPromise;
}

async function loadClient(): Promise<AuthClient | null> {
  const provider = getAuthProvider();
  if (provider === "clerk") {
    const { createClerkAuthClient } = await import("./clerkClient");
    return createClerkAuthClient();
  }
  if (provider === "cognito") {
    const { createCognitoAuthClient } = await import("./cognitoClient");
    return createCognitoAuthClient();
  }
  return null;
}

/** Test-only: drop the cached client so a new provider selection applies. */
export function resetAuthClientForTesting(): void {
  clientPromise = null;
  warnedAmbiguous = false;
}
