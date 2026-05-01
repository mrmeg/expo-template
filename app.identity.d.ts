export interface AppIdentity {
  /** Human-readable app name shown in app stores and home screens. */
  name: string;
  /** Expo project slug (URL-safe, lowercase). */
  slug: string;
  /** Native deep-link scheme (no `://`). */
  scheme: string;
  /** iOS bundle identifier (reverse-DNS). */
  iosBundleIdentifier: string;
  /** Android package name (reverse-DNS). */
  androidPackage: string;
}

/**
 * Resolve the active identity from env, falling back to defaults when
 * a value is empty or unset. Throws if any provided override is malformed.
 */
export function getAppIdentity(env?: Record<string, string | undefined>): AppIdentity;

/** Defaults exposed for tests + docs. */
export const APP_IDENTITY_DEFAULTS: AppIdentity;

/**
 * Build a deep-link URL for the active app scheme.
 * `scheme://path` — leading slash on `path` is normalized away.
 */
export function buildDeepLink(scheme: string, path: string): string;
