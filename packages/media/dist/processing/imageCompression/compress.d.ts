/**
 * Web image compression implementation using Canvas API.
 * This file is used on web platform only.
 */
import type { CompressedImage, CompressImageOptions } from "./types";
/**
 * Compress an image using the Canvas API.
 *
 * Features:
 * - Resize to max dimension while maintaining aspect ratio
 * - Adjustable quality for JPEG/WebP
 * - Progressive quality reduction to hit target file size
 * - Returns both URI (blob URL) and Blob for upload flexibility
 *
 * @param options - Compression options including URI, dimensions, and config
 * @returns Promise resolving to CompressedImage with blob URL and metadata
 */
export declare function compressImage(options: CompressImageOptions): Promise<CompressedImage>;
