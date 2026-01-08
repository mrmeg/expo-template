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
