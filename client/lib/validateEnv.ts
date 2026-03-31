/**
 * Environment variable validation utility.
 *
 * Call validateClientEnv() at app startup to catch missing vars early.
 * In development, logs warnings. In production, throws with a clear list.
 */

interface EnvRule {
  key: string;
  required: boolean;
  context: string;
}

const CLIENT_ENV_RULES: EnvRule[] = [
  { key: "EXPO_PUBLIC_USER_POOL_ID", required: true, context: "Auth (Cognito)" },
  { key: "EXPO_PUBLIC_USER_POOL_CLIENT_ID", required: true, context: "Auth (Cognito)" },
  { key: "EXPO_PUBLIC_API_URL", required: true, context: "API" },
];

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

  if (__DEV__) {
    console.warn(`⚠️ ${message}`);
  } else {
    throw new Error(message);
  }
}

/**
 * Validate client-side environment variables (EXPO_PUBLIC_*).
 * Call early in app startup before any service initialization.
 */
export function validateClientEnv(): void {
  validate(CLIENT_ENV_RULES, "client");
}

/**
 * Validate server-side environment variables (R2_*, etc.).
 * Call from API routes or server startup.
 */
export function validateServerEnv(): void {
  validate(SERVER_ENV_RULES, "server");
}
