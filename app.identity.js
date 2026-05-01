/**
 * App identity — single source of truth for the values an adopter needs
 * to change when renaming the template into a new app.
 *
 * Used by:
 *   - `app.config.ts` (Expo dynamic config — Node at build time)
 *   - `client/lib/identity.ts` (runtime accessor for client code)
 *
 * Plain JS so Node's CJS resolver can load it from the transpiled
 * `app.config.js` Expo produces when reading dynamic config. Types live
 * in the sibling `app.identity.d.ts` so TypeScript consumers stay typed.
 *
 * Reads `EXPO_PUBLIC_APP_*` env vars so changes flow into both the
 * native build (via Expo prebuild) and the client bundle (via Metro
 * inlining of `process.env.EXPO_PUBLIC_*` direct property access).
 *
 * Empty / whitespace-only env values fall back to the defaults so a fresh
 * clone keeps booting unchanged.
 */

"use strict";

const DEFAULT_IDENTITY = {
  name: "template",
  slug: "template",
  scheme: "myapp",
  iosBundleIdentifier: "com.mrmeg.template",
  androidPackage: "com.mrmeg.template",
};

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*$/;
const REVERSE_DNS_RE = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

function trim(value) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function validate(field, value) {
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
  default:
    return value;
  }
}

function getAppIdentity(env = process.env) {
  const overrides = {
    name: trim(env.EXPO_PUBLIC_APP_NAME),
    slug: trim(env.EXPO_PUBLIC_APP_SLUG),
    scheme: trim(env.EXPO_PUBLIC_APP_SCHEME),
    iosBundleIdentifier: trim(env.EXPO_PUBLIC_APP_IOS_BUNDLE_ID),
    androidPackage: trim(env.EXPO_PUBLIC_APP_ANDROID_PACKAGE),
  };

  const merged = { ...DEFAULT_IDENTITY };
  Object.keys(overrides).forEach((key) => {
    const value = overrides[key];
    if (value !== undefined) {
      merged[key] = validate(key, value);
    }
  });

  return merged;
}

const APP_IDENTITY_DEFAULTS = { ...DEFAULT_IDENTITY };

function buildDeepLink(scheme, path) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${scheme}://${cleanPath}`;
}

module.exports = {
  APP_IDENTITY_DEFAULTS,
  buildDeepLink,
  getAppIdentity,
};
