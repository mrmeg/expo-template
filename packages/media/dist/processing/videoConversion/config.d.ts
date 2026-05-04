/**
 * Configuration presets for video conversion
 */
import type { VideoConversionConfig, VideoConversionPreset } from "./types";
/**
 * Conversion presets with FFmpeg settings
 * - fast: Quick conversion, larger file size, lower quality
 * - balanced: Good tradeoff between speed and quality
 * - quality: Slow conversion, smaller file size, best quality
 */
export declare const CONVERSION_PRESETS: Record<VideoConversionPreset, VideoConversionConfig>;
/**
 * Default preset to use
 */
export declare const DEFAULT_PRESET: VideoConversionPreset;
/**
 * FFmpeg.wasm CDN URL for loading the core
 * Using jsdelivr for better CORS support - ESM format for module worker compatibility
 */
export declare const FFMPEG_CORE_VERSION = "0.12.6";
export declare const FFMPEG_CDN_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
/**
 * Local worker URL served by Metro/Express
 * Metro bundler doesn't properly import FFmpeg workers, so we serve it manually
 * Using bundled ESM worker that has dependencies inlined (no relative imports)
 */
export declare const FFMPEG_WORKER_URL = "/_expo/static/js/web/ffmpeg-worker.js";
/**
 * Maximum video size for client-side conversion (in bytes)
 * Videos larger than this should use server-side conversion
 */
export declare const MAX_CLIENT_CONVERSION_SIZE: number;
