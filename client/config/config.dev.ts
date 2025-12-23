/**
 * Development environment configuration.
 * These values override config.base.ts in development.
 */

import type { ConfigBaseProps } from "./config.base";

const DevConfig: Partial<ConfigBaseProps> = {
  // Use local API in development
  apiUrl: "http://localhost:3000/api",

  // Persist navigation state for faster dev iteration
  persistNavigation: "always",

  // Always catch errors in dev to see the error screen
  catchErrors: "always",
};

export default DevConfig;
