/**
 * Native image compression implementation using expo-image-manipulator.
 * This file is used on iOS and Android platforms only.
 */
import type { CompressedImage, CompressImageOptions } from "./types";
/**
 * Compress an image using expo-image-manipulator.
 *
 * Features:
 * - Resize to max dimension while maintaining aspect ratio
 * - Adjustable quality for JPEG/WebP
 * - Progressive quality reduction to hit target file size
 * - Native HEIC support (no conversion needed)
 * - Returns file URI for use with expo-file-system or fetch
 *
 * @param options - Compression options including URI, dimensions, and config
 * @returns Promise resolving to CompressedImage with file URI and metadata
 */
export declare function compressImage(options: CompressImageOptions): Promise<CompressedImage>;
