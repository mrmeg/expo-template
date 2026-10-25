/**
 * Thumbnails for videos that were uploaded without one.
 *
 * Nothing here runs by itself: reading a frame downloads video data, so the app
 * decides when. `backfillVideoThumbnail` does one video and never rejects;
 * `useVideoThumbnailBackfill` runs many with bounded concurrency.
 */

import { Platform } from "react-native";
import type { MediaUploadOptions, MediaUploadResult } from "../client";
import { logMediaDebug } from "../processing/logger";
import { extractVideoThumbnail } from "../processing/videoThumbnails";
import { mediaKeyId } from "../thumbnails";

export interface BackfillVideoThumbnailInput {
  /** Storage key of the video, e.g. "videos/01ABC.mov"; its ID names the thumbnail. */
  videoKey: string;
  /** A readable (signed) URL for the same video. */
  videoUrl: string;
}

export interface BackfillVideoThumbnailOptions<TMediaType extends string = string> {
  upload: (options: MediaUploadOptions<TMediaType>) => Promise<MediaUploadResult>;
  thumbnailMediaType: TMediaType;
  /** @default the video key's ID (same as the upload queue) */
  filename?: (videoKey: string) => string;
  /** Frame time. @default 1000 */
  timeMs?: number;
  /** Test seam. @default extractVideoThumbnail */
  extract?: (
    uri: string,
    timeMs: number,
  ) => Promise<{ uri: string; blob?: Blob; width: number; height: number } | null>;
}

export type BackfillVideoThumbnailResult =
  | { status: "uploaded"; videoKey: string; key: string }
  | { status: "failed"; videoKey: string; errorMessage: string; error?: unknown };

const FRAME_UNREADABLE_MESSAGE = "Could not read a frame from the video.";
const FRAME_UNREADABLE_WEB_MESSAGE =
  "Could not read a frame from the video. On web the bucket must allow CORS for this origin, or the browser blocks reading the frame.";

function revokeObjectUrl(uri: string): void {
  if (!uri.startsWith("blob:")) return;
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(uri);
  } catch (error) {
    logMediaDebug(`Could not revoke ${uri}: ${String(error)}`);
  }
}

function failed(
  videoKey: string,
  errorMessage: string,
  error?: unknown,
): BackfillVideoThumbnailResult {
  return { status: "failed", videoKey, errorMessage, ...(error !== undefined ? { error } : {}) };
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

/**
 * Reads a frame from the video's signed URL and uploads it as the thumbnail
 * whose ID matches the video's, so it pairs the way an upload-queue thumbnail
 * does. Resolves with the outcome; it never rejects.
 *
 * On web the frame is drawn to a canvas, which the browser blocks when the
 * bucket serves the video without CORS headers for this origin. That surfaces as
 * a failed result whose `errorMessage` says so. The upload needs the server to
 * allow custom filenames for `thumbnailMediaType` (`allowCustomFilename`),
 * otherwise the key would not carry the video's ID.
 *
 * A `blob:` URL the extraction created is revoked before this resolves.
 */
export async function backfillVideoThumbnail<TMediaType extends string>(
  input: BackfillVideoThumbnailInput,
  options: BackfillVideoThumbnailOptions<TMediaType>,
): Promise<BackfillVideoThumbnailResult> {
  const { videoKey, videoUrl } = input;
  const extract = options.extract ?? extractVideoThumbnail;

  let thumbnail: Awaited<ReturnType<typeof extract>>;
  try {
    thumbnail = await extract(videoUrl, options.timeMs ?? 1000);
  } catch (error) {
    logMediaDebug(`Video thumbnail backfill: extraction threw for ${videoKey}: ${String(error)}`);
    return failed(videoKey, `${FRAME_UNREADABLE_MESSAGE} ${describeError(error)}`, error);
  }
  if (!thumbnail) {
    return failed(
      videoKey,
      Platform.OS === "web" ? FRAME_UNREADABLE_WEB_MESSAGE : FRAME_UNREADABLE_MESSAGE,
    );
  }

  try {
    const filename = (options.filename ?? mediaKeyId)(videoKey);
    // Without it the server mints a random key, and the thumbnail pairs with nothing.
    if (!filename) {
      return failed(videoKey, "Could not derive a thumbnail filename from the video key.");
    }

    const size = thumbnail.blob?.size;
    const result = await options.upload({
      file: thumbnail.blob ?? thumbnail.uri,
      contentType: "image/jpeg",
      mediaType: options.thumbnailMediaType,
      customFilename: filename,
      ...(size ? { size } : {}),
    });
    return { status: "uploaded", videoKey, key: result.key };
  } catch (error) {
    logMediaDebug(`Video thumbnail backfill: upload failed for ${videoKey}: ${String(error)}`);
    return failed(videoKey, `Could not upload the thumbnail. ${describeError(error)}`, error);
  } finally {
    revokeObjectUrl(thumbnail.uri);
  }
}
