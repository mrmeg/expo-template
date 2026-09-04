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
export type MediaPath = (typeof MEDIA_PATHS)[MediaType];

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

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

/**
 * Get the thumbnail path for a video.
 * Videos stored at media/videos/abc.mp4 have thumbnails at media/thumbnails/abc.jpg
 */
export function getVideoThumbnailKey(videoKey: string): string {
  const filename = videoKey.split("/").pop() || videoKey;
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
  return `${MEDIA_PATHS.thumbnails}/${nameWithoutExt}.jpg`;
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
