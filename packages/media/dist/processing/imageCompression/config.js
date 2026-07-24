/**
 * Image compression configuration and presets.
 * Shared between client and server for consistent typing.
 */
/**
 * Predefined compression presets for common use cases.
 */
export const IMAGE_PRESETS = {
    /** Profile pictures, small squares. Target: ~50-200KB */
    avatar: {
        maxDimension: 512,
        quality: 0.8,
        maxSizeKB: 200,
        minQuality: 0.6,
        format: "jpeg",
    },
    /** Small preview images. Target: ~30-100KB */
    thumbnail: {
        maxDimension: 256,
        quality: 0.7,
        maxSizeKB: 100,
        minQuality: 0.5,
        format: "jpeg",
    },
    /** Product/item images. Target: ~200-500KB */
    product: {
        maxDimension: 1024,
        quality: 0.85,
        maxSizeKB: 500,
        minQuality: 0.6,
        format: "jpeg",
    },
    /** High-quality gallery images. Target: ~500KB-1MB */
    gallery: {
        maxDimension: 2048,
        quality: 0.85,
        maxSizeKB: 1000,
        minQuality: 0.65,
        format: "jpeg",
    },
    /** Large images for detail views. Target: ~1-2MB */
    highQuality: {
        maxDimension: 3000,
        quality: 0.9,
        maxSizeKB: 2000,
        minQuality: 0.7,
        format: "jpeg",
    },
    /** No compression - original file preserved */
    none: null,
};
/** Default preset when none specified */
export const DEFAULT_PRESET = "gallery";
/**
 * Resolve compression options from preset name or custom config.
 */
export function resolveCompressionConfig(options) {
    if (options === null || options === undefined || options === "none") {
        return null;
    }
    if (typeof options === "string") {
        const preset = IMAGE_PRESETS[options];
        return preset ? { ...preset } : null;
    }
    // Merge custom options with gallery defaults
    const defaults = IMAGE_PRESETS.gallery;
    return {
        maxDimension: options.maxDimension ?? defaults.maxDimension,
        quality: options.quality ?? defaults.quality,
        maxSizeKB: options.maxSizeKB ?? defaults.maxSizeKB,
        minQuality: options.minQuality ?? defaults.minQuality,
        format: options.format ?? defaults.format,
    };
}
