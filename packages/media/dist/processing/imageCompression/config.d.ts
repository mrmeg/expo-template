/**
 * Image compression configuration and presets.
 * Shared between client and server for consistent typing.
 */
export interface CompressionConfig {
    /** Max dimension (width or height) in pixels. Maintains aspect ratio. */
    maxDimension: number | null;
    /** JPEG/WebP quality (0-1). Lower = smaller file, more artifacts. */
    quality: number;
    /** Target max file size in KB. Will reduce quality progressively to achieve. */
    maxSizeKB: number | null;
    /** Minimum quality floor when reducing to hit maxSizeKB. */
    minQuality: number;
    /** Output format. null = keep original format (except HEIC → JPEG). */
    format: "jpeg" | "webp" | "png" | null;
}
/**
 * Predefined compression presets for common use cases.
 */
export declare const IMAGE_PRESETS: {
    /** Profile pictures, small squares. Target: ~50-200KB */
    readonly avatar: {
        readonly maxDimension: 512;
        readonly quality: 0.8;
        readonly maxSizeKB: 200;
        readonly minQuality: 0.6;
        readonly format: "jpeg";
    };
    /** Small preview images. Target: ~30-100KB */
    readonly thumbnail: {
        readonly maxDimension: 256;
        readonly quality: 0.7;
        readonly maxSizeKB: 100;
        readonly minQuality: 0.5;
        readonly format: "jpeg";
    };
    /** Product/item images. Target: ~200-500KB */
    readonly product: {
        readonly maxDimension: 1024;
        readonly quality: 0.85;
        readonly maxSizeKB: 500;
        readonly minQuality: 0.6;
        readonly format: "jpeg";
    };
    /** High-quality gallery images. Target: ~500KB-1MB */
    readonly gallery: {
        readonly maxDimension: 2048;
        readonly quality: 0.85;
        readonly maxSizeKB: 1000;
        readonly minQuality: 0.65;
        readonly format: "jpeg";
    };
    /** Large images for detail views. Target: ~1-2MB */
    readonly highQuality: {
        readonly maxDimension: 3000;
        readonly quality: 0.9;
        readonly maxSizeKB: 2000;
        readonly minQuality: 0.7;
        readonly format: "jpeg";
    };
    /** No compression - original file preserved */
    readonly none: null;
};
export type ImagePreset = keyof typeof IMAGE_PRESETS;
/** Default preset when none specified */
export declare const DEFAULT_PRESET: ImagePreset;
/**
 * Resolve compression options from preset name or custom config.
 */
export declare function resolveCompressionConfig(options: ImagePreset | Partial<CompressionConfig> | null | undefined): CompressionConfig | null;
