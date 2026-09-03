/**
 * The one orchestrator.
 *
 * Every picked asset goes through this function on both platforms, and it
 * returns one immutable result whose `contentType` is guaranteed to be in the
 * caller's allowlist — or it throws `MediaProcessingError` and the asset is
 * reported as failed. There is no third outcome, and in particular no
 * `application/octet-stream` fallback: that fallback is what let a phone's HEIF
 * photo reach the server with a content type the server refuses.
 *
 * The function is UI-free. Progress reaches the app through `onPhase`, so the
 * hook keeps owning its toasts.
 */

import { MediaProcessingError } from "./errors";
import { logMediaDebug as logDev } from "./logger";
import { contentTypeFromFileName } from "./sniff";
import {
  chooseUploadCandidate,
  isAllowlistedContentType,
  isUnknownContentType,
  normalizeContentType,
  resolveUploadFormatPolicy,
  type UploadOutputFormat,
} from "./uploadPolicy";
import type { ImagePlatformAdapter } from "./adapter";
import { compressImageWith } from "./imageCompression/compressImage";
import { imagePlatformAdapter } from "./imageCompression/compress";
import type { CompressionConfig } from "./imageCompression/config";
import type { ImageSource } from "./imageCompression/types";
import { displayDimensions, formatFileSize, longEdgeOf } from "./imageCompression/utils";
import {
  MAX_CLIENT_CONVERSION_SIZE,
  TARGET_MIME_TYPE,
  convertVideo,
  needsConversion,
} from "./videoConversion";
import { extractVideoThumbnail } from "./videoThumbnails";

/** Quality used when an asset must be transcoded but no ladder was requested. */
const TRANSCODE_ONLY_QUALITY = 0.9;

/** Frame the video thumbnail is taken from. Unchanged from the previous pipeline. */
const VIDEO_THUMBNAIL_TIME_MS = 1000;

export type ProcessedUploadKind = "image" | "video";

/** What the caller hands over: a picker asset, reduced to what processing needs. */
export interface ProcessAssetInput {
  uri: string;
  /** Web only. Saves the pipeline a re-fetch of bytes the caller already holds. */
  blob?: Blob;
  /** The picker's declared type. Sniffed when blank or `application/octet-stream`. */
  contentType?: string | null;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  /** The picker's reported byte size, when it reports one. */
  size?: number | null;
  kind?: ProcessedUploadKind | null;
  durationSeconds?: number | null;
  /** EXIF orientation, so ladder dims can be computed in displayed orientation. */
  exifOrientation?: number | null;
}

export interface ProcessedThumbnail {
  readonly uri: string;
  readonly blob?: Blob;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
}

/**
 * The single, immutable processing result. No caller mutates it and no branch
 * updates it in place — that pattern is what made the old pipeline's content
 * type ownership impossible to follow.
 */
export interface ProcessedUpload {
  readonly kind: ProcessedUploadKind;
  readonly uri: string;
  readonly blob?: Blob;
  /** Always a member of the allowlist passed in. */
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  /** Human-readable trace of what happened, in order. */
  readonly applied: readonly string[];
  /** Byte size before processing, when known (`0` when the picker withheld it). */
  readonly originalSize: number;
  /** True when even the smallest ladder rung missed the byte budget. */
  readonly overBudget: boolean;
  readonly durationSeconds?: number;
  readonly thumbnail?: ProcessedThumbnail;
}

export type ProcessingPhase =
  | { type: "identifying" }
  | { type: "decoding-heic" }
  | { type: "compressing" }
  | { type: "passthrough" }
  | { type: "converting-video"; progress?: number; loadingConverter?: boolean }
  | { type: "extracting-thumbnail" }
  | { type: "complete" };

export interface ContentTypeAllowlist {
  readonly image: readonly string[];
  readonly video: readonly string[];
}

export interface ProcessAssetOptions {
  asset: ProcessAssetInput;
  /** The server's accepted content types. Nothing else is ever produced. */
  allowlist: ContentTypeAllowlist;
  /** Resolved ladder config, or `null` to skip the ladder. */
  config?: CompressionConfig | null;
  /** Platform seam. Defaults to the real adapter for the current platform. */
  adapter?: ImagePlatformAdapter;
  onPhase?: (asset: ProcessAssetInput, phase: ProcessingPhase) => void;
}

function resolveKind(
  asset: ProcessAssetInput,
  contentType: string,
): ProcessedUploadKind {
  if (asset.kind === "video" || asset.kind === "image") return asset.kind;
  return contentType.startsWith("video/") ? "video" : "image";
}

/**
 * Identify the asset. A specific declared type is trusted; a blank or opaque one
 * goes to the platform sniffer (bytes on web, extension on native) and then to
 * the file name.
 */
async function identifyContentType(
  asset: ProcessAssetInput,
  source: ImageSource,
  adapter: ImagePlatformAdapter,
  notifyPhase: (phase: ProcessingPhase) => void,
): Promise<string> {
  const declared = normalizeContentType(asset.contentType);
  if (declared && !isUnknownContentType(declared)) return declared;

  notifyPhase({ type: "identifying" });
  const sniffed = normalizeContentType(
    await adapter.sniffContentType(source, asset.fileName ?? undefined),
  );
  if (sniffed && !isUnknownContentType(sniffed)) return sniffed;

  return normalizeContentType(
    contentTypeFromFileName(asset.fileName) ?? contentTypeFromFileName(asset.uri),
  );
}

/** Source size, preferring the picker's number and never failing the asset. */
async function measureSource(
  asset: ProcessAssetInput,
  source: ImageSource,
  adapter: ImagePlatformAdapter,
): Promise<number> {
  if (typeof asset.size === "number" && asset.size > 0) return asset.size;
  if (asset.blob && asset.blob.size > 0) return asset.blob.size;
  try {
    return await adapter.measure(source);
  } catch {
    // Unknown source size is survivable: `chooseUploadCandidate` treats it as
    // "cannot win the size comparison" rather than as zero bytes.
    logDev(`Could not measure source size for ${asset.uri}`);
    return 0;
  }
}

async function resolveDimensions(
  asset: ProcessAssetInput,
  source: ImageSource,
  adapter: ImagePlatformAdapter,
): Promise<{ width: number; height: number }> {
  const declaredWidth = asset.width ?? 0;
  const declaredHeight = asset.height ?? 0;

  if (declaredWidth > 0 && declaredHeight > 0) {
    return displayDimensions(declaredWidth, declaredHeight, asset.exifOrientation);
  }

  // HEIC assets come out of the pickers as 0x0, so this path runs after any
  // HEIC decode — probing undecodable bytes would throw.
  const probed = await adapter.probeDimensions(source);
  return displayDimensions(probed.width, probed.height, asset.exifOrientation);
}

function transcodeOnlyConfig(longEdge: number): CompressionConfig {
  return {
    rungs: [longEdge > 0 ? longEdge : 4096],
    quality: TRANSCODE_ONLY_QUALITY,
    byteBudget: 0,
    passthroughBytes: 0,
    format: null,
  };
}

async function processImageAsset(
  options: ProcessAssetOptions,
  adapter: ImagePlatformAdapter,
  contentType: string,
  notifyPhase: (phase: ProcessingPhase) => void,
): Promise<ProcessedUpload> {
  const { asset, allowlist } = options;
  const applied: string[] = [];
  const original: ImageSource = { uri: asset.uri, blob: asset.blob };

  const policy = resolveUploadFormatPolicy({
    contentType,
    allowlist: allowlist.image,
  });

  if (policy.action === "reject") {
    throw new MediaProcessingError(
      "unsupported-format",
      policy.reason ?? "This file type cannot be uploaded.",
      { contentType: policy.sourceContentType },
    );
  }

  const originalSize = await measureSource(asset, original, adapter);

  // HEIC: web has to decode before anything can draw the pixels; native decodes
  // HEIF inside the encoder, so there is no adapter hook and nothing to release.
  let source = original;
  let sourceContentType = policy.sourceContentType;
  let intermediate: ImageSource | null = null;

  if (policy.requiresHeicDecode && adapter.decodeHeic) {
    notifyPhase({ type: "decoding-heic" });
    source = await adapter.decodeHeic(original, asset.fileName ?? undefined);
    intermediate = source;
    sourceContentType = "image/jpeg";
    applied.push("heic-decode");
  }

  try {
    const { width, height } = await resolveDimensions(asset, source, adapter);
    const sourceAllowlisted = isAllowlistedContentType(sourceContentType, allowlist.image);
    const config = options.config ?? null;

    // GIF and friends: allowlisted and never re-encodable. Pass the bytes on.
    if (policy.action === "passthrough" || (!config && sourceAllowlisted)) {
      notifyPhase({ type: "passthrough" });
      applied.push("passthrough");
      intermediate = null; // The passthrough result *is* the intermediate.
      return freeze({
        kind: "image",
        uri: source.uri,
        blob: source.blob,
        contentType: sourceContentType,
        width,
        height,
        size: source.blob?.size ?? originalSize,
        applied,
        originalSize,
        overBudget: false,
      });
    }

    const fastPathBudget = config?.passthroughBytes ?? 0;
    const largestRung = config ? Math.max(...config.rungs) : 0;
    const withinFastPath =
      sourceAllowlisted &&
      fastPathBudget > 0 &&
      originalSize > 0 &&
      originalSize <= fastPathBudget &&
      longEdgeOf(width, height) <= largestRung;

    if (withinFastPath) {
      notifyPhase({ type: "passthrough" });
      applied.push(`passthrough:${formatFileSize(originalSize)}`);
      intermediate = null;
      return freeze({
        kind: "image",
        uri: source.uri,
        blob: source.blob,
        contentType: sourceContentType,
        width,
        height,
        size: source.blob?.size ?? originalSize,
        applied,
        originalSize,
        overBudget: false,
      });
    }

    const format: UploadOutputFormat =
      config?.format ?? policy.outputFormat ?? "jpeg";
    const ladderConfig = config ?? transcodeOnlyConfig(longEdgeOf(width, height));

    notifyPhase({ type: "compressing" });
    const processed = await compressImageWith(adapter, {
      source,
      // Already in displayed orientation.
      width,
      height,
      config: ladderConfig,
      format,
    });

    const choice = chooseUploadCandidate(
      {
        uri: asset.uri,
        blob: asset.blob,
        contentType: policy.sourceContentType,
        size: originalSize,
        width,
        height,
      },
      {
        uri: processed.uri,
        blob: processed.blob,
        contentType: processed.contentType,
        size: processed.size,
        width: processed.width,
        height: processed.height,
      },
      allowlist.image,
    );

    if (choice.picked === "original") {
      adapter.dispose(processed);
      applied.push(`kept-original:${choice.reason}`);
      logDev(
        `Kept original ${policy.sourceContentType} (${formatFileSize(originalSize)}); re-encode was ${formatFileSize(processed.size)}`,
      );
    } else {
      applied.push(
        `resize:${processed.rung}`,
        `encode:${processed.contentType}`,
      );
      if (processed.overBudget) applied.push("over-budget");
    }

    const chosen = choice.chosen;
    assertAllowlisted(chosen.contentType, allowlist.image);

    return freeze({
      kind: "image",
      uri: chosen.uri,
      blob: chosen.blob,
      contentType: normalizeContentType(chosen.contentType),
      width: chosen.width,
      height: chosen.height,
      size: chosen.size,
      applied,
      originalSize,
      overBudget: choice.picked === "processed" ? processed.overBudget : false,
    });
  } finally {
    // Release the decoded-HEIC intermediate unless it became the result.
    if (intermediate) adapter.dispose(intermediate);
  }
}

async function processVideoAsset(
  options: ProcessAssetOptions,
  adapter: ImagePlatformAdapter,
  contentType: string,
  notifyPhase: (phase: ProcessingPhase) => void,
): Promise<ProcessedUpload> {
  const { asset, allowlist } = options;
  const applied: string[] = [];
  const originalSize = await measureSource(
    asset,
    { uri: asset.uri, blob: asset.blob },
    adapter,
  );

  let uri = asset.uri;
  let blob = asset.blob;
  let size = originalSize;
  let resultContentType = contentType;

  // Video conversion is unchanged behaviourally (FFmpeg on web, unsupported on
  // native) except for the keep-original guard, which is now format-aware: a
  // WebM→MP4 conversion is never discarded for being larger.
  if (needsConversion(contentType) && originalSize <= MAX_CLIENT_CONVERSION_SIZE) {
    const temporaryUri = blob ? URL.createObjectURL(blob) : null;
    try {
      notifyPhase({ type: "converting-video", loadingConverter: true });
      const converted = await convertVideo(temporaryUri ?? uri, contentType, {
        preset: "fast",
        onProgress: (progress) => notifyPhase({ type: "converting-video", progress }),
        onLoadingFFmpeg: () =>
          notifyPhase({ type: "converting-video", loadingConverter: true }),
      });

      const choice = chooseUploadCandidate(
        { uri, blob, contentType, size: originalSize },
        {
          uri: converted.uri,
          blob: converted.blob,
          contentType: converted.mimeType || TARGET_MIME_TYPE,
          size: converted.size,
        },
        allowlist.video,
      );

      if (choice.picked === "processed") {
        uri = choice.chosen.uri;
        blob = choice.chosen.blob;
        size = choice.chosen.size;
        resultContentType = choice.chosen.contentType;
        applied.push(`video-convert:${converted.originalFormat}->mp4`);
      } else {
        adapter.dispose({ uri: converted.uri });
        applied.push(`kept-original:${choice.reason}`);
      }
    } catch (error) {
      // A conversion failure is only fatal if the source itself is unuploadable,
      // which the allowlist assertion below decides.
      logDev(`Video conversion failed: ${String(error)}`);
      applied.push("video-convert-failed");
    } finally {
      if (temporaryUri) URL.revokeObjectURL(temporaryUri);
    }
  }

  let thumbnail: ProcessedThumbnail | undefined;
  try {
    notifyPhase({ type: "extracting-thumbnail" });
    const extracted = await extractVideoThumbnail(asset.uri, VIDEO_THUMBNAIL_TIME_MS);
    if (extracted) {
      thumbnail = {
        uri: extracted.uri,
        blob: extracted.blob,
        contentType: "image/jpeg",
        width: extracted.width,
        height: extracted.height,
        size: extracted.blob?.size ?? 0,
      };
    }
  } catch (error) {
    logDev(`Video thumbnail extraction failed: ${String(error)}`);
  }

  assertAllowlisted(resultContentType, allowlist.video);

  return freeze({
    kind: "video",
    uri,
    blob,
    contentType: normalizeContentType(resultContentType),
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    size,
    applied,
    originalSize,
    overBudget: false,
    durationSeconds: asset.durationSeconds ?? undefined,
    thumbnail,
  });
}

function assertAllowlisted(contentType: string, allowlist: readonly string[]): void {
  if (isAllowlistedContentType(contentType, allowlist)) return;
  throw new MediaProcessingError(
    "unsupported-format",
    `${contentType || "This file"} cannot be uploaded.`,
    { contentType: normalizeContentType(contentType) },
  );
}

function freeze(upload: ProcessedUpload): ProcessedUpload {
  return Object.freeze({ ...upload, applied: Object.freeze([...upload.applied]) });
}

/**
 * Process one picked asset into an uploadable result.
 *
 * @throws {MediaProcessingError} When the asset cannot be represented as an
 * allowlisted content type — the caller shows this against the asset instead of
 * discovering it as a server `400 invalid-content-type`.
 */
export async function processAsset(options: ProcessAssetOptions): Promise<ProcessedUpload> {
  const adapter = options.adapter ?? imagePlatformAdapter;
  const { asset } = options;
  const notifyPhase = (phase: ProcessingPhase) => options.onPhase?.(asset, phase);

  const contentType = await identifyContentType(
    asset,
    { uri: asset.uri, blob: asset.blob },
    adapter,
    notifyPhase,
  );
  const kind = resolveKind(asset, contentType);

  const result =
    kind === "video"
      ? await processVideoAsset(options, adapter, contentType, notifyPhase)
      : await processImageAsset(options, adapter, contentType, notifyPhase);

  notifyPhase({ type: "complete" });
  logDev(
    `Processed ${result.kind}: ${formatFileSize(result.size)} ${result.contentType} (${result.width}x${result.height}) [${result.applied.join(", ")}]`,
  );
  return result;
}
