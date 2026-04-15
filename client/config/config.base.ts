/**
 * Base configuration interface and defaults.
 * These values are shared across all environments.
 */

export interface ConfigBaseProps {
  /**
   * When to persist navigation state (useful for dev to restore on refresh)
   * - "always": Always persist
   * - "dev": Only in development
   * - "prod": Only in production
   * - "never": Never persist
   */
  persistNavigation: "always" | "dev" | "prod" | "never";

  /**
   * When to catch errors with ErrorBoundary
   * - "always": Catch in all environments
   * - "dev": Only catch in development
   * - "prod": Only catch in production
   * - "never": Never catch (errors bubble up)
   */
  catchErrors: "always" | "dev" | "prod" | "never";

  /**
   * Routes where pressing back should exit the app (Android)
   */
  exitRoutes: string[];

  /**
   * Base URL for API requests
   */
  apiUrl: string;

  /**
   * Request timeout in milliseconds
   */
  apiTimeout: number;

  /**
   * Sentry DSN for error tracking. Empty string disables Sentry.
   */
  sentryDsn: string;

  /**
   * Feature flag for the hosted-external Stripe billing surface.
   * When false, billing UI is hidden and `/api/billing/*` routes
   * return a typed 503 `billing-disabled`. Reads
   * `EXPO_PUBLIC_BILLING_ENABLED`; defaults to false so projects
   * without Stripe credentials still run cleanly.
   */
  billingEnabled: boolean;

  /**
   * Absolute web origin (e.g. `https://app.example.com`) used to
   * build Stripe Checkout / Portal return URLs when the request
   * doesn't already carry one. Empty string falls back to the
   * request origin at route time.
   */
  appUrl: string;
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
  persistNavigation: "dev",
  catchErrors: "always",
  exitRoutes: ["index", "(main)"],
  apiUrl: "",
  apiTimeout: 10000,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
  billingEnabled: parseBooleanEnv(process.env.EXPO_PUBLIC_BILLING_ENABLED),
  appUrl: process.env.EXPO_PUBLIC_APP_URL ?? "",
};

export default BaseConfig;
