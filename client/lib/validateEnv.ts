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
} as const;

const SERVER_ENV_RULES: EnvRule[] = [
  { key: "R2_JURISDICTION_SPECIFIC_URL", required: true, context: "Media (R2)" },
  { key: "R2_ACCESS_KEY_ID", required: true, context: "Media (R2)" },
  { key: "R2_SECRET_ACCESS_KEY", required: true, context: "Media (R2)" },
  { key: "R2_BUCKET", required: true, context: "Media (R2)" },
];

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

  if (missing.length === 0) return;

  const message = `Missing required client environment variables:\n${missing.join("\n")}`;
  console.warn(`⚠️ ${message}`);
}

/**
 * Validate server-side environment variables (R2_*, etc.).
 * Call from API routes or server startup.
 */
export function validateServerEnv(): void {
  validate(SERVER_ENV_RULES, "server");
}
