/**
 * Runtime accessor for the active app identity.
 *
 * Reads `EXPO_PUBLIC_APP_*` env vars via direct property access so Metro
 * inlines the values into the bundle. Falls back to the same defaults
 * `app.config.ts` uses, so server-side and client-side code never disagree
 * on the deep-link scheme. Empty / whitespace-only values are treated as
 * unset.
 */

import { APP_IDENTITY_DEFAULTS } from "@/app.identity";

function pick(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

/** The native deep-link scheme (no `://`). */
export function getAppScheme(): string {
  return pick(process.env.EXPO_PUBLIC_APP_SCHEME, APP_IDENTITY_DEFAULTS.scheme);
}

/** The app's display name. */
export function getAppName(): string {
  return pick(process.env.EXPO_PUBLIC_APP_NAME, APP_IDENTITY_DEFAULTS.name);
}

/**
 * Build a deep-link URL for the active scheme. Path may start with `/`
 * or not — both produce `scheme://path`.
 */
export function buildAppDeepLink(path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${getAppScheme()}://${cleanPath}`;
}
