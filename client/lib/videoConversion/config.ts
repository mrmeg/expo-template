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
export const CONVERSION_PRESETS: Record<
  VideoConversionPreset,
  VideoConversionConfig
> = {
  fast: {
    ffmpegPreset: "ultrafast",
    crf: 28,
    description: "Quick conversion, larger file",
  },
  balanced: {
    ffmpegPreset: "medium",
    crf: 23,
    description: "Balanced speed and quality",
  },
  quality: {
    ffmpegPreset: "slow",
    crf: 18,
    description: "Best quality, slower conversion",
  },
};

/**
 * Default preset to use
 */
export const DEFAULT_PRESET: VideoConversionPreset = "fast";

/**
 * FFmpeg.wasm CDN URL for loading the core
 * Using jsdelivr for better CORS support - ESM format for module worker compatibility
 */
export const FFMPEG_CORE_VERSION = "0.12.6";
export const FFMPEG_CDN_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

/**
 * Local worker URL served by Metro/Express
 * Metro bundler doesn't properly import FFmpeg workers, so we serve it manually
 * Using bundled ESM worker that has dependencies inlined (no relative imports)
 */
export const FFMPEG_WORKER_URL = "/_expo/static/js/web/ffmpeg-worker.js";

/**
 * Maximum video size for client-side conversion (in bytes)
 * Videos larger than this should use server-side conversion
 */
export const MAX_CLIENT_CONVERSION_SIZE = 500 * 1024 * 1024; // 500MB
