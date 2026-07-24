/**
 * Native stub for video conversion
 *
 * Client-side video conversion is not supported in Expo managed workflow.
 * Native apps should upload videos in their original format.
 *
 * For formats that need conversion (WebM, etc.), consider:
 * 1. Server-side conversion via Cloudflare Stream or similar
 * 2. Adding a custom native client with native FFmpeg bindings
 * 3. Restricting video picker to MP4/MOV formats on native
 */
import type { VideoConversionOptions, VideoConversionResult } from "./types";
/**
 * Shape-compatible stub of the web-only typed error. Native never loads a
 * worker, but exporting the class keeps `instanceof` checks in shared
 * consumer code (useMediaLibrary) platform-safe.
 */
export declare class FFmpegWorkerUnavailableError extends Error {
    readonly url: string;
    readonly status?: number;
    constructor(url: string, status?: number, message?: string);
}
/**
 * Convert video - NOT SUPPORTED on native
 * @throws Error always - native conversion not available
 */
export declare function convertVideo(_uri: string, _originalMimeType: string, _options?: VideoConversionOptions): Promise<VideoConversionResult>;
/**
 * Check if FFmpeg is loaded - always false on native
 */
export declare function isFFmpegLoaded(): boolean;
/**
 * Preload FFmpeg - no-op on native
 */
export declare function preloadFFmpeg(): Promise<void>;
