/**
 * Shared utility functions for image compression.
 * Used by both web and native implementations.
 */
/**
 * Calculate target dimensions maintaining aspect ratio.
 * If the image is smaller than maxDimension, returns original dimensions.
 *
 * @param width - Original width in pixels
 * @param height - Original height in pixels
 * @param maxDimension - Maximum dimension (width or height) in pixels
 * @returns Target dimensions maintaining aspect ratio
 */
export function calculateDimensions(width, height, maxDimension) {
    if (!maxDimension || (width <= maxDimension && height <= maxDimension)) {
        return { targetWidth: width, targetHeight: height };
    }
    const aspectRatio = width / height;
    if (width > height) {
        return {
            targetWidth: maxDimension,
            targetHeight: Math.round(maxDimension / aspectRatio),
        };
    }
    else {
        return {
            targetWidth: Math.round(maxDimension * aspectRatio),
            targetHeight: maxDimension,
        };
    }
}
/**
 * Get MIME type from compression format.
 *
 * @param format - Compression format ('jpeg', 'png', 'webp', or null)
 * @returns MIME type string
 */
export function getMimeType(format) {
    switch (format) {
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
        case "jpeg":
        default:
            return "image/jpeg";
    }
}
/**
 * Calculate the next quality step for progressive compression.
 * Reduces quality by 0.05, rounded to 2 decimal places.
 *
 * @param currentQuality - Current quality value (0-1)
 * @returns Next quality value
 */
export function reduceQuality(currentQuality) {
    return Math.round((currentQuality - 0.05) * 100) / 100;
}
/**
 * Check if file size exceeds max size and quality can still be reduced.
 *
 * @param fileSize - Current file size in bytes
 * @param maxSizeKB - Maximum file size in KB (or null for no limit)
 * @param currentQuality - Current compression quality (0-1)
 * @param minQuality - Minimum quality threshold (0-1)
 * @returns true if compression should continue
 */
export function shouldContinueCompression(fileSize, maxSizeKB, currentQuality, minQuality) {
    if (!maxSizeKB)
        return false;
    const maxSizeBytes = maxSizeKB * 1024;
    return fileSize > maxSizeBytes && currentQuality > minQuality;
}
/**
 * Check whether a processed file should replace its source asset.
 *
 * Unknown source sizes (0 or negative) are treated as acceptable because
 * native pickers may omit fileSize. When the source size is known, the
 * processed output must be strictly smaller; equal-size re-encodes do not
 * reduce upload cost.
 */
export function shouldUseProcessedFile(sourceSize, processedSize) {
    return sourceSize <= 0 || processedSize < sourceSize;
}
/**
 * Check whether a compressed image should replace the source asset.
 */
export function shouldUseCompressedImage(sourceSize, compressedSize) {
    return shouldUseProcessedFile(sourceSize, compressedSize);
}
/**
 * Format file size for logging.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150KB" or "1.5MB")
 */
export function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    }
    return `${(bytes / 1024).toFixed(0)}KB`;
}
