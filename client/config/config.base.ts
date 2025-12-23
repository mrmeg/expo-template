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
}

/**
 * Default configuration values.
 * Override in config.dev.ts or config.prod.ts
 */
const BaseConfig: ConfigBaseProps = {
  persistNavigation: "dev",
  catchErrors: "always",
  exitRoutes: ["index", "(main)"],
  apiUrl: "",
  apiTimeout: 10000,
};

export default BaseConfig;
