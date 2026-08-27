/**
 * Development environment configuration.
 * These values override config.base.ts in development.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

import type { ConfigBaseProps } from "./config.base";

/**
 * The Expo Router `app/api/*` routes are served by the dev server itself, so
 * the API lives at whatever address this device used to reach Metro.
 * `hostUri` carries that address (e.g. "192.168.4.28:8082"), which also works
 * on Android emulators and physical devices where "localhost" would resolve
 * to the device rather than this machine. On web the page shares the dev
 * server's origin, so a relative path is enough.
 */
const hostUri = Constants.expoConfig?.hostUri;
const devApiUrl =
  Platform.OS === "web"
    ? "/api"
    : hostUri
      ? `http://${hostUri}/api`
      : "http://localhost:8081/api";

const DevConfig: Partial<ConfigBaseProps> = {
  apiUrl: devApiUrl,

  // Persist navigation state for faster dev iteration
  persistNavigation: "always",

  // Always catch errors in dev to see the error screen
  catchErrors: "always",
};

export default DevConfig;
