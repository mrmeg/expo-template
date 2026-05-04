/**
 * Cleanup utilities for compressed images (Native implementation).
 * Deletes temporary files from the cache directory.
 */
import type { CompressedImage } from "./types";
/**
 * Register a file URI for tracking.
 * Called internally by compressImage.
 *
 * @param uri - The file URI to track
 */
export declare function trackFileUri(uri: string): void;
export declare const trackBlobUrl: typeof trackFileUri;
/**
 * Delete a single compressed image file to free storage.
 * Safe to call multiple times or with already-deleted files.
 *
 * @param image - CompressedImage or URI string to delete
 */
export declare function revokeCompressedImage(image: CompressedImage | string): void;
/**
 * Delete multiple compressed image files.
 *
 * @param images - Array of CompressedImage objects or URI strings
 */
export declare function cleanupCompressedImages(images: (CompressedImage | string)[]): void;
/**
 * Delete all tracked compressed files.
 * Useful for cleanup on unmount or when clearing image state.
 */
export declare function revokeAllTrackedFiles(): void;
export declare const revokeAllTrackedUrls: typeof revokeAllTrackedFiles;
