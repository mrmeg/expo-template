/**
 * Shared types for image compression.
 * Used by the ladder loop and both platform encoders.
 */

import type { CompressionConfig } from "./config";
import type { UploadOutputFormat } from "../uploadPolicy";

/**
 * A decodable image handle. Native only ever has a file URI; web carries the
 * `Blob` so the pipeline never has to re-fetch bytes it already holds.
 */
export interface ImageSource {
  uri: string;
  blob?: Blob;
}

/**
 * Result of one encode. `contentType` is read back off the encoder output (web
 * `Blob.type`) rather than assumed from the request, because Safari silently
 * substitutes PNG for unsupported requested types.
 */
export interface EncodedImage {
  /** `file://` on native, `blob:` object URL on web. */
  uri: string;
  /** Present on web only. */
  blob?: Blob;
  width: number;
  height: number;
  contentType: string;
  size: number;
}

export interface EncodeImageOptions {
  source: ImageSource;
  /** Source dimensions in displayed orientation. */
  width: number;
  height: number;
  /** Long-edge cap for this rung. Already clamped to the source's long edge. */
  longEdge: number;
  /** 0-1. Ignored for PNG. */
  quality: number;
  format: UploadOutputFormat;
}

/** Platform encode primitive. One rung, one call. */
export type EncodeImage = (options: EncodeImageOptions) => Promise<EncodedImage>;

/**
 * Releases an encode result: deletes the temp file (native) / revokes the URL
 * (web). Takes anything with a `uri` so intermediate handles (a decoded HEIC,
 * for instance) can be released through the same seam.
 */
export type DisposeEncodedImage = (image: { uri: string }) => void;

/**
 * Result of running the ladder.
 */
export interface CompressedImage extends EncodedImage {
  /** Long-edge cap that produced this result. */
  rung: number;
  /** Number of encodes performed. */
  attempts: number;
  /** True when even the smallest rung missed the byte budget. */
  overBudget: boolean;
}

export interface CompressImageOptions {
  /** Source image handle. A bare URI string is accepted for convenience. */
  source: ImageSource | string;
  /** Source width in pixels. `0` asks the platform to probe it. */
  width: number;
  /** Source height in pixels. `0` asks the platform to probe it. */
  height: number;
  config: CompressionConfig;
  /** Encode format. Defaults to `config.format ?? "jpeg"`. */
  format?: UploadOutputFormat;
  /**
   * EXIF orientation, when known. Orientations 5-8 transpose the stored
   * dimensions, and both platform encoders bake the rotation into their output,
   * so ladder math has to run on the displayed dimensions.
   */
  exifOrientation?: number | null;
}
