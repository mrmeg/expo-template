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

interface EnvRule {
  key: string;
  required: boolean;
  context: string;
}

const SERVER_ENV_RULES: EnvRule[] = [
  { key: "R2_JURISDICTION_SPECIFIC_URL", required: true, context: "Media (R2)" },
  { key: "R2_ACCESS_KEY_ID", required: true, context: "Media (R2)" },
  { key: "R2_SECRET_ACCESS_KEY", required: true, context: "Media (R2)" },
  { key: "R2_BUCKET", required: true, context: "Media (R2)" },
];

const SERVER_BILLING_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function isBillingFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function validate(rules: EnvRule[], label: string): void {
  const missing = rules
    .filter((rule) => rule.required && isMissing(process.env[rule.key]))
    .map((rule) => `  - ${rule.key} (${rule.context})`);

  if (missing.length === 0) return;

  const message = `Missing required ${label} environment variables:\n${missing.join("\n")}`;
  console.warn(`⚠️ ${message}`);
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

  // Billing flag + app URL: when billing is enabled on the client, the app
  // URL anchors Stripe Checkout / Portal return URLs for native callers.
  if (isBillingFlagEnabled(billingEnabled) && isMissing(appUrl)) {
    console.warn(
      "⚠️ EXPO_PUBLIC_BILLING_ENABLED=true but EXPO_PUBLIC_APP_URL is empty. Hosted-billing return URLs will fall back to the request origin.",
    );
  }
}

/**
 * Validate server-side environment variables (R2_*, etc.).
 * Call from API routes or server startup.
 */
export function validateServerEnv(): void {
  validate(SERVER_ENV_RULES, "server");

  // Billing is opt-in. Warn if *some* but not *all* of the critical
  // secrets are set — that usually means a broken webhook config.
  const present = SERVER_BILLING_ENV_KEYS.filter((key) => !isMissing(process.env[key]));
  if (present.length > 0 && present.length < SERVER_BILLING_ENV_KEYS.length) {
    const missing = SERVER_BILLING_ENV_KEYS.filter((key) => isMissing(process.env[key]));
    console.warn(
      `⚠️ Partial Stripe billing config: missing ${missing.join(", ")}. Billing routes will return 503 until all required keys are set.`,
    );
  }
}
