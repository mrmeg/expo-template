/**
 * Pure geometry and formatting helpers shared by the ladder and both platform
 * encoders.
 */
/**
 * Calculate target dimensions maintaining aspect ratio.
 * If the image already fits `maxDimension`, the original dimensions are kept —
 * the ladder never upscales.
 *
 * @param width - Original width in pixels
 * @param height - Original height in pixels
 * @param maxDimension - Maximum dimension (width or height) in pixels
 */
export declare function calculateDimensions(width: number, height: number, maxDimension: number | null): {
    targetWidth: number;
    targetHeight: number;
};
/** Longer of the two edges. The ladder is expressed in long edges. */
export declare function longEdgeOf(width: number, height: number): number;
/**
 * Format file size for logging.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150KB" or "1.5MB")
 */
export declare function formatFileSize(bytes: number): string;
