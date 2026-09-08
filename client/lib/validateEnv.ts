/**
 * Environment variable validation utility.
 *
 * The template treats Cognito auth, an external API URL, and Stripe billing
 * as opt-in. A fresh clone with no `.env` should produce no warnings; we only
 * warn when a feature is half-configured (Cognito with one of the two vars
 * set, billing flag on with no app URL).
 *
 * Validation always warns instead of throwing so route initialization can
 * still complete and features can fail gracefully at point of use.
 */

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function isBillingFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

/**
 * Validate client-side environment variables (EXPO_PUBLIC_*).
 *
 * Direct property access is intentional — Expo only inlines
 * `process.env.EXPO_PUBLIC_*` references that survive static analysis.
 */
export function validateClientEnv(): void {
  const userPoolId = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const userPoolClientId = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
  const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const authProvider = process.env.EXPO_PUBLIC_AUTH_PROVIDER;
  const billingEnabled = process.env.EXPO_PUBLIC_BILLING_ENABLED;
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;

  // Cognito auth — both vars required when enabled, both optional when not.
  // EXPO_PUBLIC_API_URL is intentionally not validated: the template uses
  // local Expo Router api routes by default and the prod config falls back
  // to a placeholder when unset.
  const poolMissing = isMissing(userPoolId);
  const clientMissing = isMissing(userPoolClientId);
  if (poolMissing !== clientMissing) {
    const missing = poolMissing
      ? "EXPO_PUBLIC_USER_POOL_ID"
      : "EXPO_PUBLIC_USER_POOL_CLIENT_ID";
    const present = poolMissing
      ? "EXPO_PUBLIC_USER_POOL_CLIENT_ID"
      : "EXPO_PUBLIC_USER_POOL_ID";
    console.warn(
      `⚠️ Partial Cognito config: ${present} is set but ${missing} is missing. Auth will stay disabled until both are configured.`,
    );
  }

  // Explicit provider selection must point at a configured provider.
  if (authProvider === "clerk" && isMissing(clerkKey)) {
    console.warn(
      "⚠️ EXPO_PUBLIC_AUTH_PROVIDER=clerk but EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Auth will stay disabled.",
    );
  } else if (authProvider === "cognito" && (poolMissing || clientMissing)) {
    console.warn(
      "⚠️ EXPO_PUBLIC_AUTH_PROVIDER=cognito but the Cognito user-pool vars are incomplete. Auth will stay disabled.",
    );
  } else if (
    !isMissing(authProvider) &&
    authProvider !== "clerk" &&
    authProvider !== "cognito"
  ) {
    console.warn(
      `⚠️ Unknown EXPO_PUBLIC_AUTH_PROVIDER "${authProvider}". Expected "clerk" or "cognito".`,
    );
  }

  // Both providers fully configured without an explicit choice — Cognito wins,
  // but flag it so the selection is deliberate.
  if (
    isMissing(authProvider) &&
    !isMissing(clerkKey) &&
    !poolMissing &&
    !clientMissing
  ) {
    console.warn(
      "⚠️ Both Clerk and Cognito are configured; defaulting to Cognito. Set EXPO_PUBLIC_AUTH_PROVIDER to choose explicitly.",
    );
  }

  // Billing flag + app URL: when billing is enabled on the client, the app
  // URL anchors Stripe Checkout / Portal return URLs for native callers.
  if (isBillingFlagEnabled(billingEnabled) && isMissing(appUrl)) {
    console.warn(
      "⚠️ EXPO_PUBLIC_BILLING_ENABLED=true but EXPO_PUBLIC_APP_URL is empty. Hosted-billing return URLs will fall back to the request origin.",
    );
  }
}
