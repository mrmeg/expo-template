/**
 * Cleanup utilities for compressed images (Native implementation).
 * Deletes temporary files from the cache directory.
 */

import { File } from "expo-file-system";
import { logDev } from "@/client/devtools";
import type { CompressedImage } from "./types";

/**
 * Track file URIs created during compression for cleanup.
 */
const trackedFileUris = new Set<string>();

/**
 * Register a file URI for tracking.
 * Called internally by compressImage.
 *
 * @param uri - The file URI to track
 */
export function trackFileUri(uri: string): void {
  if (uri.startsWith("file://")) {
    trackedFileUris.add(uri);
  }
}

/**
 * Delete a single compressed image file to free storage.
 * Safe to call multiple times or with already-deleted files.
 *
 * @param image - CompressedImage or URI string to delete
 */
export function revokeCompressedImage(image: CompressedImage | string): void {
  const uri = typeof image === "string" ? image : image.uri;

  if (uri.startsWith("file://")) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
        logDev(`[Native] Deleted compressed file: ${uri.substring(uri.lastIndexOf("/") + 1)}`);
      }
      trackedFileUris.delete(uri);
    } catch (error) {
      logDev(`[Native] Failed to delete file: ${error}`);
    }
  }
}

/**
 * Delete multiple compressed image files.
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
 * Delete all tracked compressed files.
 * Useful for cleanup on unmount or when clearing image state.
 */
export function revokeAllTrackedFiles(): void {
  const count = trackedFileUris.size;
  for (const uri of trackedFileUris) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Ignore errors for already-deleted files
    }
  }
  trackedFileUris.clear();

  if (count > 0) {
    logDev(`[Native] Deleted ${count} tracked compressed files`);
  }
}
