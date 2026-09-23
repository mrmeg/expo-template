/**
 * Development environment configuration.
 * These values override config.base.ts in development.
 */

import type { ConfigBaseProps } from "./config.base";

const DevConfig: Partial<ConfigBaseProps> = {
  // Always catch errors in dev to see the error screen
  catchErrors: "always",
};

export default DevConfig;
