/**
 * Image compression configuration and presets.
 *
 * The model is a descending long-edge ladder at fixed quality against a byte
 * budget — the shape production messengers converged on independently. It
 * replaces the old "one max dimension plus a quality-decay loop", which could
 * not guarantee a budget and traded sharpness for artifacts before it traded
 * pixels.
 */
export interface CompressionConfig {
    /**
     * Long-edge caps in pixels, tried in order. The first rung that fits
     * `byteBudget` wins; the last rung is used even if it misses.
     */
    rungs: readonly number[];
    /** Encode quality (0-1) for lossy formats. Ignored for PNG output. */
    quality: number;
    /** Byte budget the ladder tries to fit. */
    byteBudget: number;
    /**
     * Source size in bytes at or below which an already-allowlisted source is
     * uploaded untouched. `0` disables the fast path, which is what presets with
     * a hard dimension target need.
     */
    passthroughBytes: number;
    /**
     * Output format override. `null` (the default) means the upload format policy
     * decides: PNG stays PNG, everything else encodes to JPEG. It no longer means
     * "silently JPEG".
     */
    format: "jpeg" | "png" | null;
}
/**
 * Predefined compression presets.
 *
 * Ladder rungs and budgets follow the pattern messenger clients converged on:
 * drop the dimension cap at a fixed, still-good quality rather than pushing
 * quality below ~0.7. `passthroughBytes` is 0 wherever the preset exists to hit
 * a specific display size (avatar, thumbnail, product) and 300 KB for the
 * photo-library presets, where an already-small source is not worth re-encoding.
 */
export declare const IMAGE_PRESETS: {
    /** Profile pictures, small squares. */
    readonly avatar: {
        readonly rungs: readonly [512];
        readonly quality: 0.8;
        readonly byteBudget: number;
        readonly passthroughBytes: 0;
        readonly format: null;
    };
    /** Small preview images. */
    readonly thumbnail: {
        readonly rungs: readonly [256];
        readonly quality: 0.7;
        readonly byteBudget: number;
        readonly passthroughBytes: 0;
        readonly format: null;
    };
    /** Product/item images. */
    readonly product: {
        readonly rungs: readonly [1024, 768];
        readonly quality: 0.85;
        readonly byteBudget: number;
        readonly passthroughBytes: 0;
        readonly format: null;
    };
    /** General photo-library uploads. */
    readonly gallery: {
        readonly rungs: readonly [2048, 1600, 1024];
        readonly quality: 0.8;
        readonly byteBudget: number;
        readonly passthroughBytes: number;
        readonly format: null;
    };
    /** Large images for detail views. */
    readonly highQuality: {
        readonly rungs: readonly [4096, 3072, 2048];
        readonly quality: 0.8;
        readonly byteBudget: number;
        readonly passthroughBytes: number;
        readonly format: null;
    };
    /**
     * No ladder. The pipeline still transcodes when the source content type is
     * not allowlisted (HEIC always is not), because an unuploadable file is worse
     * than a re-encoded one.
     */
    readonly none: null;
};
export type ImagePreset = keyof typeof IMAGE_PRESETS;
/** Default preset when none specified */
export declare const DEFAULT_PRESET = "gallery";
/** Lowest quality worth encoding at; below this, drop a rung instead. */
export declare const MIN_QUALITY = 0.4;
/**
 * Resolve compression options from a preset name or a partial custom config.
 *
 * Custom configs are *normalized*, not trusted: rungs come back positive,
 * deduped and descending, quality inside `[MIN_QUALITY, 1]`, budgets
 * non-negative. A caller that overrides one field can therefore never produce a
 * config the ladder cannot run — the old shape allowed exactly that (a lone
 * `{quality}` override could leave `minQuality > quality`, so the loop that was
 * supposed to hit the size target never executed).
 *
 * Unknown preset names resolve to `null` (no ladder) rather than guessing.
 */
export declare function resolveCompressionConfig(options: ImagePreset | Partial<CompressionConfig> | null | undefined): CompressionConfig | null;
