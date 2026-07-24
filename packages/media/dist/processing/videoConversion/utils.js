/**
 * Utility functions for video format detection and conversion decisions
 */
/** Video formats that need conversion to MP4 for cross-platform compatibility */
export const FORMATS_NEEDING_CONVERSION = [
    "webm",
    "avi",
    "mkv",
    "ogv",
    "wmv",
    "flv",
    "3gp",
];
/** Target format for conversion */
export const TARGET_FORMAT = "mp4";
export const TARGET_MIME_TYPE = "video/mp4";
/**
 * Check if a video needs conversion based on its MIME type
 */
export function needsConversion(mimeType) {
    if (!mimeType)
        return false;
    const format = getFormatFromMimeType(mimeType);
    return FORMATS_NEEDING_CONVERSION.includes(format);
}
/**
 * Extract format/extension from MIME type
 * e.g., "video/webm" -> "webm"
 */
export function getFormatFromMimeType(mimeType) {
    const format = mimeType.split("/")[1]?.toLowerCase();
    // Handle special cases
    if (format === "x-matroska")
        return "mkv";
    if (format === "x-msvideo")
        return "avi";
    if (format === "x-flv")
        return "flv";
    if (format === "quicktime")
        return "mov";
    return format || "unknown";
}
/**
 * Get the input format flag for FFmpeg based on MIME type
 */
export function getFFmpegInputFormat(mimeType) {
    const format = getFormatFromMimeType(mimeType);
    const formatMap = {
        webm: "webm",
        mkv: "matroska",
        avi: "avi",
        ogv: "ogg",
        wmv: "asf",
        flv: "flv",
        "3gp": "3gp",
    };
    return formatMap[format];
}
/**
 * Estimate conversion time based on video duration and preset
 * Returns estimated seconds
 */
export function estimateConversionTime(durationSeconds, preset) {
    const multipliers = {
        fast: 0.5, // 2x realtime
        balanced: 1.0, // 1x realtime
        quality: 2.0, // 0.5x realtime
    };
    return Math.ceil(durationSeconds * multipliers[preset]);
}
