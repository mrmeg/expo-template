/**
 * Adapter-agnostic `compressImage`.
 *
 * Both platform entry points (`compress.ts`, `compress.native.ts`) are one line
 * over this: bind their adapter and run the ladder. Keeping the wrapper here
 * means the two files cannot drift in behaviour, only in platform primitives.
 */
import type { ImagePlatformAdapter } from "../adapter";
import { type UploadOutputFormat } from "../uploadPolicy";
import type { CompressedImage, CompressImageOptions, ImageSource } from "./types";
export declare function toImageSource(source: ImageSource | string): ImageSource;
/**
 * Resolve the encode format. `config.format` is an explicit override; `null`
 * means "the upload policy decides", and when `compressImage` is called
 * directly without a policy the only safe default is JPEG.
 */
export declare function resolveEncodeFormat(options: Pick<CompressImageOptions, "config" | "format">): UploadOutputFormat;
export declare function compressImageWith(adapter: ImagePlatformAdapter, options: CompressImageOptions): Promise<CompressedImage>;
