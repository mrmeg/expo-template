/**
 * Sentry error tracking wrapper.
 *
 * Zero-impact when EXPO_PUBLIC_SENTRY_DSN is not set — no network requests,
 * no global handlers, and no Sentry code in the entry bundle.
 */

let initialized = false;
let sentryModulePromise: Promise<typeof import("@sentry/react-native") | null> | null = null;

function loadSentry(): Promise<typeof import("@sentry/react-native") | null> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      console.log("Sentry disabled — no EXPO_PUBLIC_SENTRY_DSN set");
    }
    return Promise.resolve(null);
  }

  sentryModulePromise ??= import("@sentry/react-native").then((Sentry) => {
    Sentry.init({
      dsn,
      debug: __DEV__,
      enabled: true,
      environment: __DEV__ ? "development" : "production",
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    });
    return Sentry;
  });

  return sentryModulePromise;
}

/**
 * Initialize Sentry. Call once at app startup (module scope in _layout.tsx).
 * No-op if sentryDsn is empty.
 */
export function setupSentry(): void {
  if (initialized) return;
  initialized = true;

  loadSentry().catch((error) => {
    if (__DEV__) {
      console.warn("Sentry failed to initialize:", error);
    }
  });
}

/**
 * Capture an exception after the optional Sentry bundle has loaded.
 * No-op when Sentry is disabled or failed to initialize.
 */
export function captureException(
  error: unknown,
  context?: Parameters<typeof import("@sentry/react-native")["captureException"]>[1]
): void {
  loadSentry().then((Sentry) => {
    Sentry?.captureException(error, context);
  }).catch((loadError) => {
    if (__DEV__) {
      console.warn("Sentry capture skipped:", loadError);
    }
  });
}
