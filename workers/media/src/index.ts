/**
 * Cloudflare Worker serving the shared media API at `cdn.mrmeg.com/api/media/*`.
 *
 * The routing, error contract, and handler behavior all come from
 * `@mrmeg/expo-media/worker`, so this file is only deployment wiring: R2
 * coordinates from `env`, KV bearer-token auth, and CORS.
 *
 * Config is built per request through the factory form so a missing secret
 * returns `503 media-disabled` instead of signing against a half-configured
 * bucket — the same fail-closed behavior as the template's API route.
 */
import { createMediaConfig } from "@mrmeg/expo-media";
import {
  createKvTokenAuthorizer,
  createMediaWorker,
  type MediaTokenAuth,
} from "@mrmeg/expo-media/worker";

export interface Env {
  /** KV namespace holding `token:<token>` -> `{"app":"<name>"}` entries. */
  MEDIA_AUTH: KVNamespace;
  /** Vars (wrangler.jsonc). */
  R2_BUCKET?: string;
  R2_JURISDICTION_SPECIFIC_URL?: string;
  /** Secrets (`wrangler secret put`). */
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

const MEDIA_STORAGE_ENV_KEYS = [
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

/** Mirrors `server/media/config.ts` in the template. */
const MEDIA_PATHS = {
  avatars: "users/avatars",
  videos: "videos",
  thumbnails: "thumbnails",
  uploads: "uploads",
} as const;

const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
] as const;

const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function getMissingStorageEnv(env: Env): string[] {
  return MEDIA_STORAGE_ENV_KEYS.filter((key) => isMissing(env[key]));
}

function getMediaConfig(env: Env) {
  const missing = getMissingStorageEnv(env);

  return createMediaConfig({
    ...(missing.length > 0 ? { disabled: { missing } } : {}),
    buckets: {
      media: {
        provider: "r2",
        bucket: env.R2_BUCKET,
        endpoint: env.R2_JURISDICTION_SPECIFIC_URL,
        region: "auto",
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      },
    },
    mediaTypes: {
      avatars: {
        bucket: "media",
        prefix: MEDIA_PATHS.avatars,
        allowedContentTypes: IMAGE_CONTENT_TYPES,
        maxBytes: 5 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      videos: {
        bucket: "media",
        prefix: MEDIA_PATHS.videos,
        allowedContentTypes: VIDEO_CONTENT_TYPES,
        maxBytes: 500 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      thumbnails: {
        bucket: "media",
        prefix: MEDIA_PATHS.thumbnails,
        allowedContentTypes: IMAGE_CONTENT_TYPES,
        maxBytes: 2 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      uploads: {
        bucket: "media",
        prefix: MEDIA_PATHS.uploads,
        allowedContentTypes: [
          ...IMAGE_CONTENT_TYPES,
          ...VIDEO_CONTENT_TYPES,
          "application/pdf",
        ],
        maxBytes: 50 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
    },
  });
}

/**
 * Reflects the request Origin. Access is gated by a bearer token rather than
 * cookies, so no origin allowlist is needed to keep the endpoint safe from
 * ambient-credential abuse; requests without an Origin (native apps,
 * server-to-server) get no CORS headers at all.
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Vary": "Origin",
  };
}

function getPreflightHeaders(request: Request): Record<string, string> {
  return {
    ...getCorsHeaders(request),
    "Access-Control-Max-Age": "86400",
  };
}

const mediaWorker = createMediaWorker<Env, MediaTokenAuth>({
  basePath: "/api/media",
  createOptions: (env) => ({
    config: () => getMediaConfig(env),
    authorize: createKvTokenAuthorizer(env.MEDIA_AUTH),
    cors: {
      getHeaders: getCorsHeaders,
      getPreflightHeaders,
    },
    policy: {
      // A valid token grants access; per-app scoping is phase 3 and hangs off
      // `auth.app`. Custom filenames stay restricted to thumbnails so callers
      // cannot choose arbitrary keys, matching the template's policy.
      canUpload: ({ auth, mediaType, customFilename }) => ({
        allowed: Boolean(auth),
        allowCustomFilename: Boolean(customFilename && mediaType === "thumbnails"),
      }),
      canRead: ({ auth }) => ({ allowed: Boolean(auth) }),
      canList: ({ auth }) => ({ allowed: Boolean(auth) }),
      canDelete: ({ auth }) => ({ allowed: Boolean(auth) }),
    },
  }),
});

// `satisfies` keeps the default export honest: if the package's worker shape
// ever stops matching a Workers module entry, typecheck fails here rather than
// at deploy time.
export default mediaWorker satisfies ExportedHandler<Env>;
