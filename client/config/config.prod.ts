/**
 * Production environment configuration.
 * These values override config.base.ts in production.
 */

import type { ConfigBaseProps } from "./config.base";

const ProdConfig: Partial<ConfigBaseProps> = {
  // Always catch errors in prod to show user-friendly error screen
  catchErrors: "always",
};

export default ProdConfig;
