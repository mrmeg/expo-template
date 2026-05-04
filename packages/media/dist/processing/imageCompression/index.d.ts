/**
 * Image compression utilities.
 *
 * Platform implementations:
 * - Web: Uses Canvas API (compress.ts)
 * - Native (iOS/Android): Uses expo-image-manipulator (compress.native.ts)
 *
 * Both implementations provide feature parity:
 * - Resize to max dimension maintaining aspect ratio
 * - Quality control for lossy formats (JPEG, WebP)
 * - Progressive quality reduction to hit target file size
 * - Support for JPEG, PNG, and WebP output formats
 *
 * @example
 * ```tsx
 * import { compressImage, resolveCompressionConfig } from '@/client/lib/imageCompression';
 *
 * const config = resolveCompressionConfig('gallery');
 * if (config) {
 *   const result = await compressImage({
 *     uri: imageUri,
 *     width: 4000,
 *     height: 3000,
 *     config,
 *   });
 *   console.log(`Compressed to ${result.size} bytes at ${result.uri}`);
 * }
 * ```
 */
export type { CompressedImage, CompressImageOptions } from "./types";
export type { CompressionConfig, ImagePreset } from "./config";
export { IMAGE_PRESETS, DEFAULT_PRESET, resolveCompressionConfig, } from "./config";
export { compressImage } from "./compress";
export { convertHeicToJpeg } from "./heicConvert";
export { cleanupCompressedImages, revokeAllTrackedUrls, revokeCompressedImage, trackBlobUrl, } from "./cleanup";
export { calculateDimensions, getMimeType, formatFileSize, reduceQuality, shouldContinueCompression, shouldUseProcessedFile, shouldUseCompressedImage, } from "./utils";
