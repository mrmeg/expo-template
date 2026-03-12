/**
 * Shared types for image compression utilities.
 * Used by both web and native implementations.
 */

import type { CompressionConfig } from "./config";

/**
 * Result of image compression operation.
 */
export interface CompressedImage {
  /** URI to the compressed image (file:// on native, blob:// on web) */
  uri: string;
  /** Blob of compressed image (only available on web) */
  blob?: Blob;
  /** Width of compressed image in pixels */
  width: number;
  /** Height of compressed image in pixels */
  height: number;
  /** MIME type of compressed image */
  mimeType: string;
  /** Size of compressed image in bytes */
  size: number;
}

/**
 * Options for image compression.
 */
export interface CompressImageOptions {
  /** URI of the source image */
  uri: string;
  /** Original width of the image */
  width: number;
  /** Original height of the image */
  height: number;
  /** Compression configuration */
  config: CompressionConfig;
  /** Original file size in bytes (optional, for logging) */
  originalSize?: number;
}
