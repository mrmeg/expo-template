/**
 * Web build of the app-owned Sentry wrapper. Same exports as `sentry.ts`
 * (which native keeps), two differences:
 *
 * 1. `@sentry/react` instead of `@sentry/react-native`. On web the RN SDK is a
 *    wrapper around `@sentry/browser` plus ~200 kB of native-only integrations
 *    (RN tracing, profiling, feedback, replay stubs) that never run in a
 *    browser. `@sentry/react` is the same version the RN SDK depends on, so
 *    the two platforms report through one Sentry release.
 *
 * 2. The SDK loads on idle, not at startup. `RootLayout` calls `setupSentry()`
 *    during module evaluation, so the eager version fetched a ~700 kB chunk in
 *    parallel with hydration on every page load. Now the fetch waits for
 *    `requestIdleCallback` (3 s cap) so first paint and hydration keep the
 *    network and main thread; anything thrown before the SDK is up is buffered
 *    from the global `error` / `unhandledrejection` events and forwarded after
 *    `init`. `captureException` still forces the load immediately — an error is
 *    a good reason to fetch the SDK.
 *
 * Both files gate on `EXPO_PUBLIC_SENTRY_DSN` and are no-ops without it. The
 * server render has no `window`, so the whole module is inert there.
 */

type SentryModule = typeof import("@sentry/react");

let initialized = false;
let sentryModulePromise: Promise<SentryModule | null> | null = null;

/** Errors seen by the global handlers before the SDK finished loading. */
const MAX_BUFFERED_ERRORS = 20;
const bufferedErrors: unknown[] = [];
let detachPreInitHandlers: (() => void) | null = null;

function getDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function attachPreInitHandlers(): void {
  if (detachPreInitHandlers || !isBrowser()) return;

  const onError = (event: ErrorEvent) => {
    if (bufferedErrors.length < MAX_BUFFERED_ERRORS) {
      bufferedErrors.push(event.error ?? event.message);
    }
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (bufferedErrors.length < MAX_BUFFERED_ERRORS) {
      bufferedErrors.push(event.reason);
    }
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  detachPreInitHandlers = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    detachPreInitHandlers = null;
  };
}

function loadSentry(): Promise<SentryModule | null> {
  const dsn = getDsn();
  if (!dsn || !isBrowser()) {
    if (__DEV__ && !dsn) {
      console.log("Sentry disabled - no EXPO_PUBLIC_SENTRY_DSN set");
    }
    return Promise.resolve(null);
  }

  sentryModulePromise ??= import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      debug: __DEV__,
      enabled: true,
      environment: __DEV__ ? "development" : "production",
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      // `tracesSampleRate` is inert in the browser SDK without this; it is what
      // the RN SDK's default tracing integration provided on web before.
      integrations: [Sentry.browserTracingIntegration()],
    });

    // Sentry's own global handlers are installed by `init`; hand over what we
    // saw while the chunk was in flight and stop listening.
    detachPreInitHandlers?.();
    for (const error of bufferedErrors.splice(0)) {
      Sentry.captureException(error);
    }

    return Sentry;
  });

  return sentryModulePromise;
}

/** Run `task` once the browser is idle, or after `timeoutMs` at the latest. */
function whenIdle(task: () => void, timeoutMs: number): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => task(), { timeout: timeoutMs });
    return;
  }
  setTimeout(task, Math.min(timeoutMs, 1500));
}

export function setupSentry(): void {
  if (initialized) return;
  initialized = true;

  if (!getDsn() || !isBrowser()) {
    if (__DEV__ && !getDsn()) {
      console.log("Sentry disabled - no EXPO_PUBLIC_SENTRY_DSN set");
    }
    return;
  }

  attachPreInitHandlers();
  whenIdle(() => {
    loadSentry().catch((error) => {
      if (__DEV__) {
        console.warn("Sentry failed to initialize:", error);
      }
    });
  }, 3000);
}

export function captureException(
  error: unknown,
  context?: Parameters<SentryModule["captureException"]>[1]
): void {
  loadSentry()
    .then((Sentry) => {
      Sentry?.captureException(error, context);
    })
    .catch((loadError) => {
      if (__DEV__) {
        console.warn("Sentry capture skipped:", loadError);
      }
    });
}
