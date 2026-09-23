/**
 * Base configuration interface and defaults.
 * These values are shared across all environments.
 */

import { describeApiBaseUrl } from "@/client/lib/api/apiOrigin";

export interface ConfigBaseProps {
  /**
   * When to catch errors with ErrorBoundary
   * - "always": Catch in all environments
   * - "dev": Only catch in development
   * - "prod": Only catch in production
   * - "never": Never catch (errors bubble up)
   */
  catchErrors: "always" | "dev" | "prod" | "never";

  /**
   * Where `/api/*` requests go, for display (settings, developer screen).
   * Requests resolve through `client/lib/api/apiOrigin.ts`, which this mirrors:
   * - web: `"/api"` — same-origin relative requests
   * - native: `<EXPO_PUBLIC_API_URL origin>/api`; in development without it,
   *   the dev server that served the bundle
   * - native release build without `EXPO_PUBLIC_API_URL`: `""` — API requests
   *   fail closed
   */
  apiUrl: string;

  /**
   * Feature flag for the hosted-external Stripe billing surface.
   * When false, billing UI is hidden and `/api/billing/*` routes
   * return a typed 503 `billing-disabled`. Reads
   * `EXPO_PUBLIC_BILLING_ENABLED`; defaults to false so projects
   * without Stripe credentials still run cleanly.
   */
  billingEnabled: boolean;
}

/**
 * Default configuration values.
 * Override in config.dev.ts or config.prod.ts
 */
function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1";
}

const BaseConfig: ConfigBaseProps = {
  catchErrors: "always",
  apiUrl: describeApiBaseUrl(),
  billingEnabled: parseBooleanEnv(process.env.EXPO_PUBLIC_BILLING_ENABLED),
};

export default BaseConfig;
