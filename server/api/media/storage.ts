/**
 * Compatibility exports for older app-local media route tests.
 *
 * The reusable storage implementation now lives in `@mrmeg/expo-media/server`
 * and is configured through `server/media/*`. Keep these helpers as the
 * template's R2 env adapter surface so existing imports do not drift.
 */

import {
  getMissingMediaStorageEnv,
  MEDIA_STORAGE_ENV_KEYS,
  type MediaStorageEnvKey,
} from "@/server/media/config";
import { resetMediaStorageForTests } from "@/server/media/handlers";
import { jsonErrorResponse } from "../shared/errors";

interface ConfiguredStorage {
  kind: "configured";
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface UnconfiguredStorage {
  kind: "unconfigured";
  missing: MediaStorageEnvKey[];
}

export type MediaStorageEnv = ConfiguredStorage | UnconfiguredStorage;
export { MEDIA_STORAGE_ENV_KEYS, type MediaStorageEnvKey };

export function getMediaStorageEnv(): MediaStorageEnv {
  const missing = getMissingMediaStorageEnv();
  if (missing.length > 0) return { kind: "unconfigured", missing };

  return {
    kind: "configured",
    endpoint: process.env.R2_JURISDICTION_SPECIFIC_URL!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
  };
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

export function _resetMediaStorageForTests(): void {
  resetMediaStorageForTests();
}
