/**
 * Cleanup utilities for compressed images (Web implementation).
 * Revokes blob URLs to free memory.
 */

import { logDev } from "@/client/devtools";
import type { CompressedImage } from "./types";

/**
 * Track blob URLs created during compression for cleanup.
 */
const trackedBlobUrls = new Set<string>();

/**
 * Register a blob URL for tracking.
 * Called internally by compressImage.
 *
 * @param url - The blob URL to track
 */
export function trackBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    trackedBlobUrls.add(url);
  }
}

/**
 * Revoke a single compressed image's blob URL to free memory.
 * Safe to call multiple times or with non-blob URLs.
 *
 * @param image - CompressedImage or URI string to revoke
 */
export function revokeCompressedImage(image: CompressedImage | string): void {
  const uri = typeof image === "string" ? image : image.uri;

  if (uri.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(uri);
      trackedBlobUrls.delete(uri);
      logDev(`[Web] Revoked blob URL: ${uri.substring(0, 50)}...`);
    } catch (error) {
      logDev(`[Web] Failed to revoke blob URL: ${error}`);
    }
  }
}

/**
 * Revoke multiple compressed images' blob URLs.
 *
 * @param images - Array of CompressedImage objects or URI strings
 */
export function cleanupCompressedImages(
  images: (CompressedImage | string)[]
): void {
  for (const image of images) {
    revokeCompressedImage(image);
  }
}

/**
 * Revoke all tracked blob URLs.
 * Useful for cleanup on unmount or when clearing image state.
 */
export function revokeAllTrackedUrls(): void {
  const count = trackedBlobUrls.size;
  for (const url of trackedBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore errors for already-revoked URLs
    }
  }
  trackedBlobUrls.clear();

  if (count > 0) {
    logDev(`[Web] Revoked ${count} tracked blob URLs`);
  }
}
