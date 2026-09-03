/**
 * Native image encoding (expo-image-manipulator). Metro resolves this file for
 * iOS and Android.
 *
 * This is the encode *primitive* plus the platform adapter — one rung, one call.
 * All ladder logic lives in `ladder.ts` so both platforms share it.
 *
 * Two native-specific hazards are handled here:
 * - Handles: `manipulate()` and `renderAsync()` both allocate native bitmaps
 *   that must be `release()`d, or a 20-photo batch holds 20 full-resolution
 *   bitmaps and gets the app killed.
 * - Stat: a failed `File.size` read is an error. Reporting `0` (as the previous
 *   implementation did) makes every size comparison downstream wrong.
 */
import type { ImagePlatformAdapter } from "../adapter";
import type { CompressedImage, CompressImageOptions, EncodedImage, EncodeImageOptions } from "./types";
/**
 * Byte size of a file URI. Throws rather than returning `0`: an unmeasurable
 * encode cannot be compared against the source or checked against the budget.
 */
export declare function statSize(uri: string): number;
/** One rung: manipulate, render, save, stat, release everything. */
export declare function encodeImageNative(options: EncodeImageOptions): Promise<EncodedImage>;
export declare function disposeEncodedImageNative(image: {
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
