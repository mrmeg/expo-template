import type {
  CompressionConfig,
  ImagePreset,
} from "@mrmeg/expo-media/processing/image-compression/config";
import type { MediaType } from "@/shared/media";

type ImageCompressionSettings = {
  enabled: boolean;
  defaultPreset: ImagePreset;
  userOverrides: Partial<CompressionConfig> | null;
};

type ProcessingSettings = {
  keepOriginalIfLarger: boolean;
};

type UploadSettings = {
  selectionLimit: number;
  defaultImageMediaType: MediaType;
  defaultVideoMediaType: MediaType;
  uploadVideoThumbnails: boolean;
  deleteVideoThumbnailWithVideo: boolean;
};

export type MediaUploadPolicy = {
  mediaType: MediaType;
  compression?: ImagePreset | Partial<CompressionConfig> | null;
};

export type MediaAppSettings = {
  imageCompression: ImageCompressionSettings;
  processing: ProcessingSettings;
  uploads: UploadSettings;
  uploadPolicies: {
    avatar: MediaUploadPolicy;
    generalImage: MediaUploadPolicy;
    originalImage: MediaUploadPolicy;
    video: MediaUploadPolicy;
  };
};

export type MediaUploadPolicyName = keyof MediaAppSettings["uploadPolicies"];

export type MediaUploadFilter = "all" | MediaType;

export type MediaUploadPolicyAsset = {
  type?: string | null;
  mimeType?: string | null;
};

export type ResolvedMediaUploadPolicy = {
  name: MediaUploadPolicyName;
  policy: MediaUploadPolicy;
};

/**
 * App-owned media defaults.
 *
 * The reusable package owns the processing and storage primitives; this file
 * defines how this app uses them by default. Other apps should copy this shape
 * and adjust it instead of scattering upload behavior across screens.
 */
export const MEDIA_APP_SETTINGS: MediaAppSettings = {
  imageCompression: {
    enabled: true,
    defaultPreset: "gallery",
    userOverrides: null,
  },
  processing: {
    keepOriginalIfLarger: true,
  },
  uploads: {
    selectionLimit: 20,
    defaultImageMediaType: "uploads",
    defaultVideoMediaType: "videos",
    uploadVideoThumbnails: true,
    deleteVideoThumbnailWithVideo: true,
  },
  uploadPolicies: {
    avatar: {
      mediaType: "avatars",
      compression: "avatar",
    },
    generalImage: {
      mediaType: "uploads",
      compression: "gallery",
    },
    originalImage: {
      mediaType: "uploads",
      compression: "none",
    },
    video: {
      mediaType: "videos",
      compression: null,
    },
  },
};

export function resolveMediaUploadPolicy(
  asset: MediaUploadPolicyAsset,
  filter: MediaUploadFilter,
): ResolvedMediaUploadPolicy {
  if (isVideoUploadAsset(asset)) {
    return {
      name: "video",
      policy: MEDIA_APP_SETTINGS.uploadPolicies.video,
    };
  }

  if (filter === "avatars") {
    return {
      name: "avatar",
      policy: MEDIA_APP_SETTINGS.uploadPolicies.avatar,
    };
  }

  return {
    name: "generalImage",
    policy: MEDIA_APP_SETTINGS.uploadPolicies.generalImage,
  };
}

function isVideoUploadAsset(asset: MediaUploadPolicyAsset): boolean {
  return asset.type === "video" || Boolean(asset.mimeType?.startsWith("video/"));
}
