/**
 * Media storage bootstrap shared by every `/api/media/*` route.
 *
 * Defers `S3Client` construction until storage env is actually configured so
 * an unconfigured template never instantiates a client with empty
 * credentials, and routes can short-circuit with a typed
 * `503 media-disabled` response that the Media tab renders as a setup
 * state instead of a generic crash.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { jsonErrorResponse } from "../shared/errors";

export const MEDIA_STORAGE_ENV_KEYS = [
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export type MediaStorageEnvKey = (typeof MEDIA_STORAGE_ENV_KEYS)[number];

interface ConfiguredStorage {
  kind: "configured";
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface UnconfiguredStorage {
  kind: "unconfigured";
  /** Names only — never the values. */
  missing: MediaStorageEnvKey[];
}

export type MediaStorageEnv = ConfiguredStorage | UnconfiguredStorage;

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

export function getMediaStorageEnv(): MediaStorageEnv {
  const endpoint = process.env.R2_JURISDICTION_SPECIFIC_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  const missing = MEDIA_STORAGE_ENV_KEYS.filter((key) =>
    isMissing(process.env[key]),
  );

  if (missing.length > 0) {
    return { kind: "unconfigured", missing };
  }

  return {
    kind: "configured",
    endpoint: endpoint!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  };
}

let cachedClient: { client: S3Client; endpoint: string } | null = null;

export function getMediaS3Client(env: ConfiguredStorage): S3Client {
  // Reuse the client unless the endpoint changes (mostly relevant for
  // tests that flip env between runs; `_resetMediaStorageForTests`
  // clears the cache too).
  if (cachedClient && cachedClient.endpoint === env.endpoint) {
    return cachedClient.client;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    forcePathStyle: true,
  });
  cachedClient = { client, endpoint: env.endpoint };
  return client;
}

export function mediaDisabledResponse(
  request: Request,
  missing: MediaStorageEnvKey[],
): Response {
  return jsonErrorResponse(request, 503, {
    code: "media-disabled",
    message:
      "Media storage is not configured. Set the missing R2/S3 env vars to enable uploads, listing, and signed URLs.",
    missing,
  });
}

/**
 * Test-only escape hatch — drops the cached `S3Client` so the next call
 * to `getMediaS3Client` rebuilds against the current env. Production code
 * never needs this.
 */
export function _resetMediaStorageForTests(): void {
  cachedClient = null;
}
