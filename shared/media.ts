import { videoThumbnailKey, type VideoThumbnailPairing } from "@mrmeg/expo-media";

/**
 * Media path constants shared between client and server.
 * Defines the folder structure for different media types in R2/S3.
 */

export const MEDIA_PATHS = {
  /** User profile avatars */
  avatars: "users/avatars",
  /** Video files */
  videos: "videos",
  /** Video thumbnails (auto-generated from videos) */
  thumbnails: "thumbnails",
  /** General uploads (images, documents, etc.) */
  uploads: "uploads",
} as const;

export type MediaType = keyof typeof MEDIA_PATHS;

/**
 * Content types the server accepts for images.
 *
 * This is the client's processing target as well as the server's allowlist, so
 * it lives here rather than server-side: the pipeline is only correct if both
 * sides agree, and the client has to know what to encode *to*.
 *
 * `image/heic` is deliberately absent. The client always transcodes HEIC to
 * JPEG, and accepting HEIC here would let an undisplayable file (no browser can
 * render HEIF) into storage while hiding client-side transcode failures.
 */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  // Alias some clients send; the pipeline normalises it to image/jpeg.
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Content types the server accepts for videos. */
export const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

/** Shape `processAsset` takes: what the upload target will accept. */
export const MEDIA_CONTENT_TYPE_ALLOWLIST = {
  image: IMAGE_CONTENT_TYPES,
  video: VIDEO_CONTENT_TYPES,
} as const;

/**
 * How a video finds its thumbnail: the same ID under `thumbnails/`, so
 * `videos/01ABC.mov` pairs with `thumbnails/01ABC.jpg`. The upload queue names
 * thumbnails this way, the server deletes them with their video, and the media
 * tab joins the two lists by it.
 */
export const VIDEO_THUMBNAIL_PAIRING: VideoThumbnailPairing = {
  thumbnailPrefix: MEDIA_PATHS.thumbnails,
};

/** `videos/01ABC.mov` -> `thumbnails/01ABC.jpg`. */
export function getVideoThumbnailKey(videoKey: string): string {
  return videoThumbnailKey(videoKey, VIDEO_THUMBNAIL_PAIRING);
}

/**
 * Check if a file key is a video based on extension.
 */
export function isVideoKey(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext || "");
}

/**
 * Check if a file key is an image based on extension.
 */
export function isImageKey(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(ext || "");
}
