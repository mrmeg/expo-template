/**
 * Image compression: a descending long-edge ladder at fixed quality against a
 * byte budget.
 *
 * The ladder loop (`ladder.ts`) is shared; only the encode primitive is
 * platform-specific, and Metro picks it:
 * - Web: Canvas API (`compress.ts`)
 * - Native: expo-image-manipulator (`compress.native.ts`)
 *
 * Most apps should call `processAsset` from `@mrmeg/expo-media/processing`
 * instead — it wraps this with the upload format policy, so its output is
 * guaranteed to be a content type the server accepts.
 *
 * @example
 * ```tsx
 * import {
 *   compressImage,
 *   resolveCompressionConfig,
 * } from "@mrmeg/expo-media/processing/image-compression";
 *
 * const config = resolveCompressionConfig("gallery");
 * if (config) {
 *   const result = await compressImage({
 *     source: imageUri,
 *     width: 4000,
 *     height: 3000,
 *     config,
 *   });
 *   console.log(`${result.size} bytes at ${result.rung}px (${result.uri})`);
 * }
 * ```
 */
// Presets and config resolution
export { IMAGE_PRESETS, DEFAULT_PRESET, resolveCompressionConfig, } from "./config.js";
// The ladder, and the adapter-agnostic wrapper both platforms share
export { resolveLadderRungs, runDimensionLadder } from "./ladder.js";
export { compressImageWith, resolveEncodeFormat, toImageSource, } from "./compressImage.js";
// Platform entry points. Metro resolves to compress.ts (web) or
// compress.native.ts (iOS/Android).
export { compressImage, imagePlatformAdapter } from "./compress.js";
// HEIC decoding (web; native decodes HEIF inside the encoder)
export { convertHeicToJpeg, convertHeicToJpegIfNeeded, hasHeicExtension, isHeicBlob, } from "./heicConvert.js";
// Canvas ceilings (web)
export { CANVAS_LIMIT_CHROMIUM, CANVAS_LIMIT_DEFAULT, CANVAS_LIMIT_FIREFOX, CANVAS_LIMIT_IOS, canvasLongEdgeLimitFor, clampLongEdgeToCanvasLimit, currentCanvasLongEdgeLimit, } from "./canvasLimits.js";
// Pure helpers
export { calculateDimensions, formatFileSize, longEdgeOf } from "./utils.js";
