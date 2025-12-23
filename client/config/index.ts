/**
 * Environment-aware configuration export.
 * Merges base config with environment-specific overrides.
 */

import BaseConfig, { type ConfigBaseProps } from "./config.base";
import DevConfig from "./config.dev";
import ProdConfig from "./config.prod";

// Select the environment-specific config
const EnvironmentConfig = __DEV__ ? DevConfig : ProdConfig;

// Merge base with environment config
const Config: ConfigBaseProps = {
  ...BaseConfig,
  ...EnvironmentConfig,
};

export default Config;
export type { ConfigBaseProps };
