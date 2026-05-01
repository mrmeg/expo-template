/**
 * App identity — single source of truth for the values an adopter needs
 * to change when renaming the template into a new app.
 *
 * Used by:
 *   - `app.config.ts` (Expo dynamic config — Node at build time)
 *   - `client/lib/identity.ts` (runtime accessor for client code)
 *
 * Stays plain TS with no client/Node imports so both contexts can require
 * it. Reads `EXPO_PUBLIC_APP_*` env vars so changes flow into both the
 * native build (via Expo prebuild) and the client bundle (via Metro
 * inlining of `process.env.EXPO_PUBLIC_*` direct property access).
 *
 * Empty / whitespace-only env values fall back to the defaults so a fresh
 * clone keeps booting unchanged.
 */

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
 * Default values that ship with the template. Adopters override via env.
 */
const DEFAULT_IDENTITY: AppIdentity = {
  name: "template",
  slug: "template",
  scheme: "myapp",
  iosBundleIdentifier: "com.mrmeg.template",
  androidPackage: "com.mrmeg.template",
};

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*$/;
const REVERSE_DNS_RE = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

function trim(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Validate a single identity field. Returns the validated value or
 * throws an Error naming the field; throws *only* when the env override
 * is malformed — falling back to the default is silent.
 */
function validate(field: keyof AppIdentity, value: string): string {
  switch (field) {
  case "scheme":
    if (!SCHEME_RE.test(value)) {
      throw new Error(
        `Invalid app scheme "${value}". Must match RFC 3986 scheme syntax: lowercase letter followed by letters/digits/+/-/. (e.g. "myapp", "com.example.app").`,
      );
    }
    return value;
  case "iosBundleIdentifier":
  case "androidPackage":
    if (!REVERSE_DNS_RE.test(value)) {
      throw new Error(
        `Invalid ${field} "${value}". Must be reverse-DNS (e.g. "com.example.MyApp").`,
      );
    }
    return value;
  case "slug":
    if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
      throw new Error(
        `Invalid app slug "${value}". Use lowercase letters, digits, and hyphens (e.g. "my-app").`,
      );
    }
    return value;
  case "name":
    return value;
  }
}

/**
 * Resolve the active identity from env, falling back to defaults when
 * a value is empty or unset. Throws if any provided override is malformed
 * — broken native build IDs and deep-link schemes are easier to fix at
 * config-load time than after a build.
 */
export function getAppIdentity(env: Record<string, string | undefined> = process.env): AppIdentity {
  const overrides: Partial<AppIdentity> = {
    name: trim(env.EXPO_PUBLIC_APP_NAME),
    slug: trim(env.EXPO_PUBLIC_APP_SLUG),
    scheme: trim(env.EXPO_PUBLIC_APP_SCHEME),
    iosBundleIdentifier: trim(env.EXPO_PUBLIC_APP_IOS_BUNDLE_ID),
    androidPackage: trim(env.EXPO_PUBLIC_APP_ANDROID_PACKAGE),
  };

  const merged: AppIdentity = { ...DEFAULT_IDENTITY };
  (Object.keys(overrides) as (keyof AppIdentity)[]).forEach((key) => {
    const value = overrides[key];
    if (value !== undefined) {
      merged[key] = validate(key, value);
    }
  });

  return merged;
}

/** Expose the defaults so tests + docs can reference them without a copy. */
export const APP_IDENTITY_DEFAULTS: AppIdentity = { ...DEFAULT_IDENTITY };

/**
 * Build a deep-link URL for the active app scheme.
 *
 * `scheme://path` — leading slash on `path` is normalized away.
 */
export function buildDeepLink(scheme: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${scheme}://${cleanPath}`;
}
