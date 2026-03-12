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

// Re-export types
export type { CompressedImage, CompressImageOptions } from "./types";
export type { CompressionConfig, ImagePreset } from "./config";

// Re-export config utilities
export {
  IMAGE_PRESETS,
  DEFAULT_PRESET,
  resolveCompressionConfig,
} from "./config";

// Re-export compression function
// Metro bundler resolves to the correct platform file:
// - compress.ts for web
// - compress.native.ts for iOS/Android
export { compressImage } from "./compress";

// Re-export HEIC conversion (web only - no-op on native)
export { convertHeicToJpeg } from "./heicConvert";

// Re-export cleanup utility
export { cleanupCompressedImages, revokeCompressedImage } from "./cleanup";

// Re-export utility functions (for testing and advanced use cases)
export {
  calculateDimensions,
  getMimeType,
  formatFileSize,
} from "./utils";
