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
export function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number | null,
): { targetWidth: number; targetHeight: number } {
  if (!maxDimension || (width <= maxDimension && height <= maxDimension)) {
    return { targetWidth: width, targetHeight: height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      targetWidth: maxDimension,
      targetHeight: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      targetWidth: Math.round(maxDimension * aspectRatio),
      targetHeight: maxDimension,
    };
  }
}

/** Longer of the two edges. The ladder is expressed in long edges. */
export function longEdgeOf(width: number, height: number): number {
  return Math.max(width > 0 ? width : 0, height > 0 ? height : 0);
}

/**
 * Format file size for logging.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150KB" or "1.5MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  }
  return `${(bytes / 1024).toFixed(0)}KB`;
}
