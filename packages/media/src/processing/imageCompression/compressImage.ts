/**
 * Adapter-agnostic `compressImage`.
 *
 * Both platform entry points (`compress.ts`, `compress.native.ts`) are one line
 * over this: bind their adapter and run the ladder. Keeping the wrapper here
 * means the two files cannot drift in behaviour, only in platform primitives.
 */

import type { ImagePlatformAdapter } from "../adapter";
import { contentTypeForFormat, type UploadOutputFormat } from "../uploadPolicy";
import { runDimensionLadder } from "./ladder";
import type { CompressedImage, CompressImageOptions, ImageSource } from "./types";

export function toImageSource(source: ImageSource | string): ImageSource {
  return typeof source === "string" ? { uri: source } : source;
}

/**
 * Resolve the encode format. `config.format` is an explicit override; `null`
 * means "the upload policy decides", and when `compressImage` is called
 * directly without a policy the only safe default is JPEG.
 */
export function resolveEncodeFormat(
  options: Pick<CompressImageOptions, "config" | "format">,
): UploadOutputFormat {
  return options.format ?? options.config.format ?? "jpeg";
}

export async function compressImageWith(
  adapter: ImagePlatformAdapter,
  options: CompressImageOptions,
): Promise<CompressedImage> {
  const source = toImageSource(options.source);
  const format = resolveEncodeFormat(options);
  const { config } = options;

  // Both branches are already in displayed orientation: callers pass displayed
  // dimensions, and the probes read them off an orientation-normalized bitmap.
  const { width, height } =
    options.width > 0 && options.height > 0
      ? { width: options.width, height: options.height }
      : await adapter.probeDimensions(source);

  const result = await runDimensionLadder({
    source,
    width,
    height,
    rungs: config.rungs,
    quality: config.quality,
    byteBudget: config.byteBudget,
    format,
    encode: adapter.encode,
    dispose: adapter.dispose,
  });

  // The encoder is the authority on what it produced (Safari substitutes types
  // silently), but a blank `Blob.type` still has to resolve to something the
  // allowlist can match.
  return result.contentType
    ? result
    : { ...result, contentType: contentTypeForFormat(format) };
}
