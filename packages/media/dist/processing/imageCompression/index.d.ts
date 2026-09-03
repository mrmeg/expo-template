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
export type { CompressedImage, CompressImageOptions, DisposeEncodedImage, EncodedImage, EncodeImage, EncodeImageOptions, ImageSource, } from "./types";
export type { CompressionConfig, ImagePreset } from "./config";
export type { DimensionLadderOptions } from "./ladder";
export { IMAGE_PRESETS, DEFAULT_PRESET, resolveCompressionConfig, } from "./config";
export { resolveLadderRungs, runDimensionLadder } from "./ladder";
export { compressImageWith, resolveEncodeFormat, toImageSource, } from "./compressImage";
export { compressImage, imagePlatformAdapter } from "./compress";
export { convertHeicToJpeg, convertHeicToJpegIfNeeded, hasHeicExtension, isHeicBlob, } from "./heicConvert";
export { CANVAS_LIMIT_CHROMIUM, CANVAS_LIMIT_DEFAULT, CANVAS_LIMIT_FIREFOX, CANVAS_LIMIT_IOS, canvasLongEdgeLimitFor, clampLongEdgeToCanvasLimit, currentCanvasLongEdgeLimit, } from "./canvasLimits";
export { calculateDimensions, formatFileSize, longEdgeOf } from "./utils";
