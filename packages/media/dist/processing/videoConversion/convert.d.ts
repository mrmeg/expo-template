/**
 * Web implementation of video conversion using FFmpeg.wasm
 *
 * Converts non-MP4 videos (WebM, AVI, MKV, etc.) to MP4 (H.264/AAC)
 * for cross-platform playback compatibility.
 *
 * Note: FFmpeg.wasm is ~30MB and loaded lazily on first use.
 *
 * IMPORTANT: This file loads FFmpeg via script injection instead of npm import
 * because @ffmpeg/ffmpeg uses import.meta.url which Metro doesn't support.
 */
import type { VideoConversionOptions, VideoConversionResult } from "./types";
/**
 * Typed error raised when the FFmpeg worker URL does not resolve to the
 * expected worker script. Distinct from generic network failures so the
 * caller can surface a specific "worker unavailable" message instead of a
 * hang.
 */
export declare class FFmpegWorkerUnavailableError extends Error {
    readonly url: string;
    readonly status?: number;
    constructor(url: string, status?: number, message?: string);
}
/**
 * Convert a video to MP4 (H.264/AAC) format
 *
 * @param uri - Source video URI (blob URL or data URL)
 * @param originalMimeType - Original MIME type for format detection
 * @param options - Conversion options (preset, progress callback)
 * @returns Converted video result with blob and URI
 *
 * @example
 * ```ts
 * const result = await convertVideo(videoUri, 'video/webm', {
 *   preset: 'balanced',
 *   onProgress: (p) => console.log(`${p}% complete`),
 * });
 * ```
 */
export declare function convertVideo(uri: string, originalMimeType: string, options?: VideoConversionOptions): Promise<VideoConversionResult>;
/**
 * Check if FFmpeg is already loaded
 */
export declare function isFFmpegLoaded(): boolean;
/**
 * Preload FFmpeg.wasm without converting
 * Useful for preloading while user is selecting a video
 */
export declare function preloadFFmpeg(): Promise<void>;
