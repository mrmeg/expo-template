/**
 * Cleanup utilities for compressed images (Web implementation).
 * Revokes blob URLs to free memory.
 */
import type { CompressedImage } from "./types";
/**
 * Register a blob URL for tracking.
 * Called internally by compressImage.
 *
 * @param url - The blob URL to track
 */
export declare function trackBlobUrl(url: string): void;
/**
 * Revoke a single compressed image's blob URL to free memory.
 * Safe to call multiple times or with non-blob URLs.
 *
 * @param image - CompressedImage or URI string to revoke
 */
export declare function revokeCompressedImage(image: CompressedImage | string): void;
/**
 * Revoke multiple compressed images' blob URLs.
 *
 * @param images - Array of CompressedImage objects or URI strings
 */
export declare function cleanupCompressedImages(images: (CompressedImage | string)[]): void;
/**
 * Revoke all tracked blob URLs.
 * Useful for cleanup on unmount or when clearing image state.
 */
export declare function revokeAllTrackedUrls(): void;
