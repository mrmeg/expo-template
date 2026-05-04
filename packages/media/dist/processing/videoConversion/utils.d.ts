/**
 * Utility functions for video format detection and conversion decisions
 */
/** Video formats that need conversion to MP4 for cross-platform compatibility */
export declare const FORMATS_NEEDING_CONVERSION: readonly ["webm", "avi", "mkv", "ogv", "wmv", "flv", "3gp"];
/** Target format for conversion */
export declare const TARGET_FORMAT = "mp4";
export declare const TARGET_MIME_TYPE = "video/mp4";
/**
 * Check if a video needs conversion based on its MIME type
 */
export declare function needsConversion(mimeType: string | undefined): boolean;
/**
 * Extract format/extension from MIME type
 * e.g., "video/webm" -> "webm"
 */
export declare function getFormatFromMimeType(mimeType: string): string;
/**
 * Get the input format flag for FFmpeg based on MIME type
 */
export declare function getFFmpegInputFormat(mimeType: string): string | undefined;
/**
 * Estimate conversion time based on video duration and preset
 * Returns estimated seconds
 */
export declare function estimateConversionTime(durationSeconds: number, preset: "fast" | "balanced" | "quality"): number;
