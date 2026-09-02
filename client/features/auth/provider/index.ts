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
 *
 * `getSocialAuthProviders()` applies the same policy to the federated sign-in
 * buttons: they only appear when the env says which providers exist *and* the
 * active provider can actually start a redirect.
 */

import type { AuthClient, AuthProviderName, SocialAuthProviderName } from "./types";

export type { AuthClient, AuthProviderName } from "./types";
export {
  AuthError,
  isAuthError,
  type AuthChangeEvent,
  type AuthErrorCode,
  type AuthFlowResult,
  type ConfirmSignUpResult,
  type ForgotPasswordResult,
  type SocialAuthProviderName,
} from "./types";

let warnedAmbiguous = false;
let warnedSocialProviders = false;
let warnedSocialDomain = false;

const SUPPORTED_SOCIAL_PROVIDERS: SocialAuthProviderName[] = ["google", "apple"];

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

/**
 * Federated sign-in buttons to offer, from `EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS`
 * (comma-separated, e.g. `"google,apple"`).
 *
 * Fails closed the same way `getAuthProvider` does — an empty list hides the
 * buttons — because every prerequisite is AWS-side and invisible to the app:
 *   - Cognito must be the active provider (Clerk's client reports
 *     `unsupported`), and
 *   - `EXPO_PUBLIC_COGNITO_DOMAIN` must name a Managed Login domain, since
 *     that's what the redirect goes through.
 * Unknown names are dropped (with one dev warning) rather than rendered as a
 * button that Cognito would reject.
 */
export function getSocialAuthProviders(): SocialAuthProviderName[] {
  const raw = process.env.EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS;
  const domain = process.env.EXPO_PUBLIC_COGNITO_DOMAIN;
  if (!isNonEmpty(raw)) return [];

  // Asking for providers without a domain is the one combination that looks
  // configured but silently renders nothing, so say so once.
  if (!isNonEmpty(domain)) {
    if (__DEV__ && !warnedSocialDomain) {
      warnedSocialDomain = true;
      console.warn(
        "⚠️ EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS is set but EXPO_PUBLIC_COGNITO_DOMAIN is missing; social sign-in buttons stay hidden.",
      );
    }
    return [];
  }
  if (getAuthProvider() !== "cognito") return [];

  const requested = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

  const unknown = requested.filter(
    (entry) => !SUPPORTED_SOCIAL_PROVIDERS.includes(entry as SocialAuthProviderName),
  );
  if (unknown.length > 0 && __DEV__ && !warnedSocialProviders) {
    warnedSocialProviders = true;
    console.warn(
      `⚠️ Ignoring unsupported EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS entries: ${unknown.join(", ")}. Supported: ${SUPPORTED_SOCIAL_PROVIDERS.join(", ")}.`,
    );
  }

  return SUPPORTED_SOCIAL_PROVIDERS.filter((provider) => requested.includes(provider));
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
  warnedSocialProviders = false;
  warnedSocialDomain = false;
}
