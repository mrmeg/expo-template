/**
 * Image compression configuration and presets.
 *
 * The model is a descending long-edge ladder at fixed quality against a byte
 * budget — the shape production messengers converged on independently. It
 * replaces the old "one max dimension plus a quality-decay loop", which could
 * not guarantee a budget and traded sharpness for artifacts before it traded
 * pixels.
 */

const KB = 1024;

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
export const IMAGE_PRESETS = {
  /** Profile pictures, small squares. */
  avatar: {
    rungs: [512],
    quality: 0.8,
    byteBudget: 200 * KB,
    passthroughBytes: 0,
    format: null,
  },

  /** Small preview images. */
  thumbnail: {
    rungs: [256],
    quality: 0.7,
    byteBudget: 100 * KB,
    passthroughBytes: 0,
    format: null,
  },

  /** Product/item images. */
  product: {
    rungs: [1024, 768],
    quality: 0.85,
    byteBudget: 500 * KB,
    passthroughBytes: 0,
    format: null,
  },

  /** General photo-library uploads. */
  gallery: {
    rungs: [2048, 1600, 1024],
    quality: 0.8,
    byteBudget: 1000 * KB,
    passthroughBytes: 300 * KB,
    format: null,
  },

  /** Large images for detail views. */
  highQuality: {
    rungs: [4096, 3072, 2048],
    quality: 0.8,
    byteBudget: 3000 * KB,
    passthroughBytes: 300 * KB,
    format: null,
  },

  /**
   * No ladder. The pipeline still transcodes when the source content type is
   * not allowlisted (HEIC always is not), because an unuploadable file is worse
   * than a re-encoded one.
   */
  none: null,
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** Default preset when none specified */
export const DEFAULT_PRESET = "gallery" satisfies ImagePreset;

/** The default preset's values, for filling gaps in a partial custom config. */
const DEFAULT_CONFIG = IMAGE_PRESETS[DEFAULT_PRESET];

/** Lowest quality worth encoding at; below this, drop a rung instead. */
export const MIN_QUALITY = 0.4;

function normalizeRungs(rungs: readonly number[], fallback: readonly number[]): number[] {
  const valid = rungs.filter((rung) => Number.isFinite(rung) && rung > 0).map(Math.round);
  if (valid.length === 0) return [...fallback];
  // Descending order is a precondition of the ladder loop, not a request.
  return [...new Set(valid)].sort((a, b) => b - a);
}

function normalizeQuality(quality: number, fallback: number): number {
  if (!Number.isFinite(quality)) return fallback;
  return Math.min(1, Math.max(MIN_QUALITY, quality));
}

function normalizeBytes(bytes: number, fallback: number): number {
  if (!Number.isFinite(bytes)) return fallback;
  return Math.max(0, Math.round(bytes));
}

function normalizeFormat(format: unknown, fallback: CompressionConfig["format"]) {
  if (format === "jpeg" || format === "png" || format === null) return format;
  return fallback;
}

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
export function resolveCompressionConfig(
  options: ImagePreset | Partial<CompressionConfig> | null | undefined,
): CompressionConfig | null {
  if (options === null || options === undefined || options === "none") {
    return null;
  }

  if (typeof options === "string") {
    const preset = IMAGE_PRESETS[options];
    if (!preset) return null;
    return { ...preset, rungs: [...preset.rungs] };
  }

  const defaults = DEFAULT_CONFIG;
  return {
    rungs: normalizeRungs(options.rungs ?? defaults.rungs, defaults.rungs),
    quality: normalizeQuality(options.quality ?? defaults.quality, defaults.quality),
    byteBudget: normalizeBytes(options.byteBudget ?? defaults.byteBudget, defaults.byteBudget),
    passthroughBytes: normalizeBytes(
      options.passthroughBytes ?? defaults.passthroughBytes,
      defaults.passthroughBytes,
    ),
    format: normalizeFormat(options.format ?? defaults.format, defaults.format),
  };
}
