/**
 * Web image encoding (Canvas API). Metro resolves this file for web only.
 *
 * This is the encode *primitive* plus the platform adapter — one rung, one call.
 * All ladder logic lives in `ladder.ts` so both platforms share it.
 *
 * Two web-specific hazards are handled here:
 * - Canvas ceilings: a canvas above the engine's limit draws blank instead of
 *   throwing, so target dimensions are clamped before drawing.
 * - `toBlob` type substitution: Safari answers an unsupported request (WebP)
 *   with PNG and says nothing, so the output's `Blob.type` is read back rather
 *   than assumed. The client never requests WebP either way.
 */
import type { ImagePlatformAdapter } from "../adapter";
import type { CompressedImage, CompressImageOptions, EncodedImage, EncodeImageOptions } from "./types";
/** One rung: decode, clamp, draw, encode, wrap. */
export declare function encodeImageWeb(options: EncodeImageOptions): Promise<EncodedImage>;
export declare function disposeEncodedImageWeb(image: {
    uri: string;
}): void;
export declare const imagePlatformAdapter: ImagePlatformAdapter;
/**
 * Run the dimension ladder on this platform.
 *
 * @returns The winning rung, flagged `overBudget` when even the smallest rung
 * missed the byte budget.
 */
export declare function compressImage(options: CompressImageOptions): Promise<CompressedImage>;
