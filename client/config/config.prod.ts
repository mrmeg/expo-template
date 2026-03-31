/**
 * Production environment configuration.
 * These values override config.base.ts in production.
 */

import type { ConfigBaseProps } from "./config.base";

const ProdConfig: Partial<ConfigBaseProps> = {
  // Production API URL — reads from env, falls back to placeholder
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://api.example.com",

  // Don't persist navigation in prod (start fresh)
  persistNavigation: "never",

  // Always catch errors in prod to show user-friendly error screen
  catchErrors: "always",
};

export default ProdConfig;
