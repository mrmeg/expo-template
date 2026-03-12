/**
 * Native stub for video conversion
 *
 * Client-side video conversion is not supported in Expo managed workflow.
 * Native apps should upload videos in their original format.
 *
 * For formats that need conversion (WebM, etc.), consider:
 * 1. Server-side conversion via Cloudflare Stream or similar
 * 2. Using expo-dev-client with native FFmpeg bindings
 * 3. Restricting video picker to MP4/MOV formats on native
 */

import type { VideoConversionOptions, VideoConversionResult } from "./types";

/**
 * Convert video - NOT SUPPORTED on native
 * @throws Error always - native conversion not available
 */
export async function convertVideo(
  _uri: string,
  _originalMimeType: string,
  _options?: VideoConversionOptions
): Promise<VideoConversionResult> {
  throw new Error(
    "Client-side video conversion is not supported on native platforms. " +
      "Videos will be uploaded in their original format. " +
      "Consider using server-side conversion for incompatible formats."
  );
}

/**
 * Check if FFmpeg is loaded - always false on native
 */
export function isFFmpegLoaded(): boolean {
  return false;
}

/**
 * Preload FFmpeg - no-op on native
 */
export async function preloadFFmpeg(): Promise<void> {
  // No-op on native
}
