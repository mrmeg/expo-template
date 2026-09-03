/**
 * The dimension ladder.
 *
 * One shared loop for both platforms: encode at the largest long-edge cap, and
 * while the result misses the byte budget, drop to the next (smaller) cap and
 * encode again from the *source* — never from the previous rung's output, which
 * would compound artifacts. Attempts are bounded by the rung list, so this
 * terminates by construction; a quality-decay loop cannot make that promise.
 *
 * Losing rungs are released the moment they lose, so a batch never accumulates
 * one temp file (native) or object URL (web) per attempt.
 */
import type { CompressedImage, DisposeEncodedImage, EncodeImage, ImageSource } from "./types";
import type { UploadOutputFormat } from "../uploadPolicy";
export interface DimensionLadderOptions {
    source: ImageSource;
    /** Source dimensions in displayed orientation. */
    width: number;
    height: number;
    /** Long-edge caps, descending. */
    rungs: readonly number[];
    quality: number;
    byteBudget: number;
    format: UploadOutputFormat;
    encode: EncodeImage;
    dispose: DisposeEncodedImage;
}
/**
 * Rungs larger than the source are pointless (upscaling), and several rungs can
 * collapse onto the same cap once clamped to a small source. Clamp, dedupe,
 * and keep descending order so each attempt is strictly smaller than the last.
 */
export declare function resolveLadderRungs(rungs: readonly number[], sourceLongEdge: number): number[];
export declare function runDimensionLadder(options: DimensionLadderOptions): Promise<CompressedImage>;
