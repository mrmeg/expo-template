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
 * EXIF orientations 5-8 rotate the image 90°, so the stored pixel dimensions are
 * transposed relative to what a viewer sees. Both `expo-image-manipulator` and
 * canvas bake the rotation into their output, which means ladder math has to be
 * done on the *displayed* dimensions or portrait photos get capped on the wrong
 * axis.
 */
export function displayDimensions(
  width: number,
  height: number,
  exifOrientation?: number | null,
): { width: number; height: number } {
  const orientation = typeof exifOrientation === "number" ? exifOrientation : 1;
  const transposed = orientation >= 5 && orientation <= 8;
  return transposed ? { width: height, height: width } : { width, height };
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
