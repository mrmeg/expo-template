/**
 * Shared utility functions for image compression.
 * Used by both web and native implementations.
 */
import type { CompressionConfig } from "./config";
/**
 * Calculate target dimensions maintaining aspect ratio.
 * If the image is smaller than maxDimension, returns original dimensions.
 *
 * @param width - Original width in pixels
 * @param height - Original height in pixels
 * @param maxDimension - Maximum dimension (width or height) in pixels
 * @returns Target dimensions maintaining aspect ratio
 */
export declare function calculateDimensions(width: number, height: number, maxDimension: number | null): {
    targetWidth: number;
    targetHeight: number;
};
/**
 * Get MIME type from compression format.
 *
 * @param format - Compression format ('jpeg', 'png', 'webp', or null)
 * @returns MIME type string
 */
export declare function getMimeType(format: CompressionConfig["format"]): string;
/**
 * Calculate the next quality step for progressive compression.
 * Reduces quality by 0.05, rounded to 2 decimal places.
 *
 * @param currentQuality - Current quality value (0-1)
 * @returns Next quality value
 */
export declare function reduceQuality(currentQuality: number): number;
/**
 * Check if file size exceeds max size and quality can still be reduced.
 *
 * @param fileSize - Current file size in bytes
 * @param maxSizeKB - Maximum file size in KB (or null for no limit)
 * @param currentQuality - Current compression quality (0-1)
 * @param minQuality - Minimum quality threshold (0-1)
 * @returns true if compression should continue
 */
export declare function shouldContinueCompression(fileSize: number, maxSizeKB: number | null, currentQuality: number, minQuality: number): boolean;
/**
 * Check whether a processed file should replace its source asset.
 *
 * Unknown source sizes (0 or negative) are treated as acceptable because
 * native pickers may omit fileSize. When the source size is known, the
 * processed output must be strictly smaller; equal-size re-encodes do not
 * reduce upload cost.
 */
export declare function shouldUseProcessedFile(sourceSize: number, processedSize: number): boolean;
/**
 * Check whether a compressed image should replace the source asset.
 */
export declare function shouldUseCompressedImage(sourceSize: number, compressedSize: number): boolean;
/**
 * Format file size for logging.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150KB" or "1.5MB")
 */
export declare function formatFileSize(bytes: number): string;
