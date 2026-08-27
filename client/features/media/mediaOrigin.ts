/**
 * Where the media client sends its requests.
 *
 * On web the app is served by the same origin as the Expo Router `app/api/*`
 * routes, so a relative base path is correct (and keeps SSR working). On native
 * there is no page origin: a relative URL makes `fetch` throw
 * `TypeError: Invalid URL`, so media needs an absolute origin or it must not
 * fire a request at all.
 *
 * The origin is read from `process.env.EXPO_PUBLIC_API_URL` directly rather
 * than from `Config.apiUrl`, because `Config` can never express "unconfigured":
 * `client/config/config.dev.ts` derives a dev-server URL and ignores the env
 * var, and `config.prod.ts` falls back to a placeholder origin. Both would
 * make a blank `.env` look configured and defeat the fail-closed rule.
 * Consequence: on native, media does not piggyback on the dev default —
 * `EXPO_PUBLIC_API_URL` must be set explicitly.
 */
import { Platform } from "react-native";

/** Path segment the Expo Router media API routes live under. */
export const MEDIA_BASE_PATH = "/api/media";

/**
 * Placeholder origin from `client/config/config.prod.ts`. Treated as
 * unconfigured for defense in depth so a blank env can't ship requests to a
 * domain nobody owns.
 */
const PLACEHOLDER_ORIGINS = ["https://api.example.com"];

export type MediaBasePathResolution =
  | { configured: true; basePath: string }
  | { configured: false };

export function resolveMediaBasePath(): MediaBasePathResolution {
  if (Platform.OS === "web") {
    return { configured: true, basePath: MEDIA_BASE_PATH };
  }

  // Static property access — Expo only inlines `process.env.EXPO_PUBLIC_*`
  // references that survive static analysis.
  const raw = process.env.EXPO_PUBLIC_API_URL;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed === "") return { configured: false };

  // The configured value may or may not already end in `/api`, and may carry
  // trailing slashes. Normalize to a bare origin so `/api/media` is appended
  // exactly once (never `/api/api/media`).
  const origin = trimmed
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "")
    .replace(/\/+$/, "");

  // Relative values (e.g. "/api") normalize to "" and are unusable on native.
  if (origin === "") return { configured: false };
  if (PLACEHOLDER_ORIGINS.includes(origin.toLowerCase())) {
    return { configured: false };
  }

  return { configured: true, basePath: `${origin}${MEDIA_BASE_PATH}` };
}
