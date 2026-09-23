/**
 * Where the app's `/api/*` requests go.
 *
 * Web: the page is served by the same server that hosts the Expo Router
 * `app/api/*` routes, so requests stay relative (same-origin, and SSR keeps
 * working).
 *
 * Native has no page origin. A relative `fetch` only works in development,
 * where Expo's fetch polyfill (`@expo/metro-runtime`) resolves it against the
 * dev server that served the bundle. A release build resolves it against
 * expo-router's `origin`, which `app.config.ts` leaves blank, so the request
 * would fail with nothing pointing at the cause. Native therefore resolves
 * `/api/*` paths against `EXPO_PUBLIC_API_URL`, and a release build without it
 * fails closed with {@link ApiOriginError} before any request goes out.
 *
 * `client/features/media/mediaOrigin.ts` reads the same variable with the same
 * normalization for the media client, which builds absolute URLs itself.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

export type ApiOrigin =
  /** Web: keep paths relative to the page. */
  | { kind: "same-origin" }
  /** Native with `EXPO_PUBLIC_API_URL`: prefix paths with this origin. */
  | { kind: "configured"; origin: string }
  /** Native development without it: Expo's fetch polyfill targets the dev server. */
  | { kind: "dev-server" }
  /** Native release build without it: no request can reach the API. */
  | { kind: "unconfigured" };

/**
 * The placeholder the template's production config used to fall back to.
 * Treated as unconfigured so a blank env can never ship requests to a domain
 * nobody owns.
 */
const PLACEHOLDER_ORIGINS = ["https://api.example.com"];

/** `https://…`, `blob:…` and other scheme-qualified or protocol-relative URLs. */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Normalize an `EXPO_PUBLIC_API_URL` value to a bare origin, or `null` when it
 * cannot serve as one. Accepts `https://host` or `https://host/api`, with or
 * without trailing slashes, so `/api/...` paths are appended exactly once.
 */
export function normalizeApiOrigin(raw: string | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const origin = trimmed
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "")
    .replace(/\/+$/, "");

  if (!/^https?:\/\/[^/]/i.test(origin)) return null;
  if (PLACEHOLDER_ORIGINS.includes(origin.toLowerCase())) return null;
  return origin;
}

export function resolveApiOrigin(): ApiOrigin {
  if (Platform.OS === "web") return { kind: "same-origin" };

  // Static property access — Expo only inlines `process.env.EXPO_PUBLIC_*`
  // references that survive static analysis.
  const configured = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);
  if (configured) return { kind: "configured", origin: configured };

  return __DEV__ ? { kind: "dev-server" } : { kind: "unconfigured" };
}

/** A native release build tried to call the API with no origin configured. */
export class ApiOriginError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(
      `Cannot request ${path}: this native build has no API origin. Set EXPO_PUBLIC_API_URL to the server that hosts app/api/* (for example https://app.example.com) and rebuild.`,
    );
    this.name = "ApiOriginError";
    this.path = path;
  }
}

export function isApiOriginError(error: unknown): error is ApiOriginError {
  return error instanceof ApiOriginError;
}

/**
 * Resolve a request URL. Absolute URLs pass through unchanged; paths follow
 * {@link resolveApiOrigin}.
 *
 * @throws {ApiOriginError} on a native release build without `EXPO_PUBLIC_API_URL`.
 */
export function resolveApiUrl(url: string): string {
  if (ABSOLUTE_URL.test(url)) return url;

  const target = resolveApiOrigin();
  switch (target.kind) {
  case "same-origin":
  case "dev-server":
    return url;
  case "configured":
    return `${target.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  case "unconfigured":
    throw new ApiOriginError(url);
  }
}

/**
 * Human-readable API base for `Config.apiUrl` (settings and developer screens):
 * `"/api"` on web, `<origin>/api` on native, `""` when a native release build
 * has no origin.
 */
export function describeApiBaseUrl(): string {
  const target = resolveApiOrigin();
  switch (target.kind) {
  case "same-origin":
    return "/api";
  case "configured":
    return `${target.origin}/api`;
  case "dev-server": {
    // What the polyfill targets: the address this device used to reach Metro,
    // e.g. "192.168.4.28:8082" (also right on Android emulators and devices,
    // where "localhost" would be the device itself).
    const hostUri = Constants.expoConfig?.hostUri;
    return hostUri ? `http://${hostUri}/api` : "http://localhost:8081/api";
  }
  case "unconfigured":
    return "";
  }
}
