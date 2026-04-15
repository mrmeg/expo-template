/**
 * Environment variable validation utility.
 *
 * Call validateClientEnv() at app startup to catch missing vars early.
 * Missing values always warn instead of throwing so route initialization
 * can still complete and features can fail gracefully at point of use.
 */

interface EnvRule {
  key: string;
  required: boolean;
  context: string;
}

const CLIENT_ENV_RULES = [
  { key: "EXPO_PUBLIC_USER_POOL_ID", required: true, context: "Auth (Cognito)" },
  { key: "EXPO_PUBLIC_USER_POOL_CLIENT_ID", required: true, context: "Auth (Cognito)" },
  { key: "EXPO_PUBLIC_API_URL", required: true, context: "API" },
] as const;

// Expo only inlines EXPO_PUBLIC_* variables for direct property access.
const CLIENT_ENV_VALUES = {
  EXPO_PUBLIC_USER_POOL_ID: process.env.EXPO_PUBLIC_USER_POOL_ID,
  EXPO_PUBLIC_USER_POOL_CLIENT_ID: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_BILLING_ENABLED: process.env.EXPO_PUBLIC_BILLING_ENABLED,
  EXPO_PUBLIC_APP_URL: process.env.EXPO_PUBLIC_APP_URL,
} as const;

const SERVER_ENV_RULES: EnvRule[] = [
  { key: "R2_JURISDICTION_SPECIFIC_URL", required: true, context: "Media (R2)" },
  { key: "R2_ACCESS_KEY_ID", required: true, context: "Media (R2)" },
  { key: "R2_SECRET_ACCESS_KEY", required: true, context: "Media (R2)" },
  { key: "R2_BUCKET", required: true, context: "Media (R2)" },
];

/**
 * Server-side billing env vars. The whole group is optional — the
 * template stays runnable without Stripe — but a partial config is a
 * footgun, so we warn when some but not all keys are set.
 */
const SERVER_BILLING_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

function isMissing(value: string | undefined): boolean {
  return value === undefined || value === "";
}

function validate(rules: EnvRule[], label: string): void {
  const missing = rules
    .filter((rule) => rule.required && isMissing(process.env[rule.key]))
    .map((rule) => `  - ${rule.key} (${rule.context})`);

  if (missing.length === 0) return;

  const message = `Missing required ${label} environment variables:\n${missing.join("\n")}`;

  // Always warn, never throw. Throwing at module scope prevents the root
  // layout from loading, which breaks Expo Router's route initialization
  // (the router falls back to the first alphabetical route).
  // Features that need these vars should fail gracefully at point of use.
  console.warn(`⚠️ ${message}`);
}

/**
 * Validate client-side environment variables (EXPO_PUBLIC_*).
 * Call early in app startup before any service initialization.
 */
export function validateClientEnv(): void {
  const missing = CLIENT_ENV_RULES
    .filter((rule) => rule.required && isMissing(CLIENT_ENV_VALUES[rule.key]))
    .map((rule) => `  - ${rule.key} (${rule.context})`);

  if (missing.length > 0) {
    const message = `Missing required client environment variables:\n${missing.join("\n")}`;
    console.warn(`⚠️ ${message}`);
  }

  // Billing flag + app URL sanity check: if billing is enabled on the
  // client, the app URL should be set so native return URLs resolve
  // back to the right origin when the request doesn't carry one.
  const billingEnabled = CLIENT_ENV_VALUES.EXPO_PUBLIC_BILLING_ENABLED;
  if (billingEnabled && (billingEnabled.toLowerCase() === "true" || billingEnabled === "1")) {
    if (isMissing(CLIENT_ENV_VALUES.EXPO_PUBLIC_APP_URL)) {
      console.warn(
        "⚠️ EXPO_PUBLIC_BILLING_ENABLED=true but EXPO_PUBLIC_APP_URL is empty. Hosted-billing return URLs will fall back to the request origin.",
      );
    }
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
