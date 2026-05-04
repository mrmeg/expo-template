/**
 * Video Conversion Module
 *
 * Converts non-MP4 videos (WebM, AVI, MKV, etc.) to MP4 (H.264/AAC)
 * for cross-platform playback compatibility.
 *
 * Platform support:
 * - Web: Full support using FFmpeg.wasm (~30MB lazy loaded)
 * - Native: Not supported (uploads original format)
 *
 * @example
 * ```ts
 * import {
 *   needsConversion,
 *   convertVideo,
 * } from '@/client/lib/videoConversion';
 *
 * if (needsConversion(asset.mimeType)) {
 *   const result = await convertVideo(asset.uri, asset.mimeType, {
 *     preset: 'balanced',
 *     onProgress: (p) => console.log(`${p}%`),
 *   });
 *   // Use result.blob and result.uri
 * }
 * ```
 */
export { convertVideo, isFFmpegLoaded, preloadFFmpeg, FFmpegWorkerUnavailableError, } from "./convert";
export { needsConversion, getFormatFromMimeType, estimateConversionTime, FORMATS_NEEDING_CONVERSION, TARGET_FORMAT, TARGET_MIME_TYPE, } from "./utils";
export { CONVERSION_PRESETS, DEFAULT_PRESET, FFMPEG_WORKER_URL, MAX_CLIENT_CONVERSION_SIZE, } from "./config";
export type { VideoConversionResult, VideoConversionOptions, VideoConversionPreset, VideoConversionConfig, } from "./types";
