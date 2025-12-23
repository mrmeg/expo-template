/**
 * Production environment configuration.
 * These values override config.base.ts in production.
 */

import type { ConfigBaseProps } from "./config.base";

const ProdConfig: Partial<ConfigBaseProps> = {
  // Production API URL - update this for your production environment
  apiUrl: "https://api.example.com",

  // Don't persist navigation in prod (start fresh)
  persistNavigation: "never",

  // Always catch errors in prod to show user-friendly error screen
  catchErrors: "always",
};

export default ProdConfig;
