/**
 * Base configuration interface and defaults.
 * These values are shared across all environments.
 */

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
   * Base URL for API requests
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
  apiUrl: "",
  billingEnabled: parseBooleanEnv(process.env.EXPO_PUBLIC_BILLING_ENABLED),
};

export default BaseConfig;
