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
 * EXIF orientations 5-8 rotate the image 90°, so the stored pixel dimensions are
 * transposed relative to what a viewer sees. Both `expo-image-manipulator` and
 * canvas bake the rotation into their output, which means ladder math has to be
 * done on the *displayed* dimensions or portrait photos get capped on the wrong
 * axis.
 */
export declare function displayDimensions(width: number, height: number, exifOrientation?: number | null): {
    width: number;
    height: number;
};
/**
 * Format file size for logging.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150KB" or "1.5MB")
 */
export declare function formatFileSize(bytes: number): string;
