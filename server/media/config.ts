import { createMediaConfig } from "@mrmeg/expo-media";

export const MEDIA_STORAGE_ENV_KEYS = [
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export type MediaStorageEnvKey = (typeof MEDIA_STORAGE_ENV_KEYS)[number];

export const TEMPLATE_MEDIA_PATHS = {
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

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

export function getMissingMediaStorageEnv(): MediaStorageEnvKey[] {
  return MEDIA_STORAGE_ENV_KEYS.filter((key) => isMissing(process.env[key]));
}

export function getTemplateMediaConfig() {
  const missing = getMissingMediaStorageEnv();
  return createMediaConfig({
    ...(missing.length > 0 ? { disabled: { missing } } : {}),
    buckets: {
      templateMedia: {
        provider: "r2",
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_JURISDICTION_SPECIFIC_URL,
        region: "auto",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      },
    },
    mediaTypes: {
      avatars: {
        bucket: "templateMedia",
        prefix: TEMPLATE_MEDIA_PATHS.avatars,
        allowedContentTypes: IMAGE_CONTENT_TYPES,
        maxBytes: 5 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      videos: {
        bucket: "templateMedia",
        prefix: TEMPLATE_MEDIA_PATHS.videos,
        allowedContentTypes: VIDEO_CONTENT_TYPES,
        maxBytes: 500 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      thumbnails: {
        bucket: "templateMedia",
        prefix: TEMPLATE_MEDIA_PATHS.thumbnails,
        allowedContentTypes: IMAGE_CONTENT_TYPES,
        maxBytes: 2 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
      uploads: {
        bucket: "templateMedia",
        prefix: TEMPLATE_MEDIA_PATHS.uploads,
        allowedContentTypes: [...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES, "application/pdf"],
        maxBytes: 50 * 1024 * 1024,
        uploadExpiresInSeconds: 300,
        readExpiresInSeconds: 86400,
      },
    },
  });
}
