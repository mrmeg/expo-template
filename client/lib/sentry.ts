/**
 * Sentry error tracking wrapper.
 *
 * Zero-impact when EXPO_PUBLIC_SENTRY_DSN is not set — no network
 * requests, no global handlers, no bundle overhead beyond the import.
 */

import * as Sentry from "@sentry/react-native";
import Config from "@/client/config";

let initialized = false;

/**
 * Initialize Sentry. Call once at app startup (module scope in _layout.tsx).
 * No-op if sentryDsn is empty.
 */
export function setupSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = Config.sentryDsn;
  if (!dsn) {
    if (__DEV__) {
      console.log("Sentry disabled — no EXPO_PUBLIC_SENTRY_DSN set");
    }
    return;
  }

  Sentry.init({
    dsn,
    debug: __DEV__,
    enabled: true,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

export { Sentry };
