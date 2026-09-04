/**
 * Upload format policy.
 *
 * One pure module decides, for a source content type and a target allowlist,
 * whether the bytes can be uploaded as-is, must be re-encoded, or cannot be
 * represented at all. Nothing here touches a platform API, so both the web and
 * native pipelines share the same answers and the same tests.
 *
 * The rule that matters: an upload is only ever sent with a content type the
 * server allowlist contains. "Keep the smaller file" is subordinate to that —
 * see `chooseUploadCandidate`.
 */

/** Formats the client is able to emit. Web canvas cannot portably emit WebP. */
export type UploadOutputFormat = "jpeg" | "png";

export type UploadPolicyAction = "passthrough" | "transcode" | "reject";

export interface UploadFormatDecision {
  action: UploadPolicyAction;
  /** Target encode format. Present only for `transcode`. */
  outputFormat?: UploadOutputFormat;
  /** Canonical content type of the source, after normalization. */
  sourceContentType: string;
  /** Whether the source content type is itself in the allowlist. */
  sourceAllowlisted: boolean;
  /** True when the source needs a HEIC decode step before it can be encoded. */
  requiresHeicDecode: boolean;
  /** True when re-encoding a (possibly) animated source flattens it. */
  flattensAnimation: boolean;
  /** Populated for `reject`. */
  reason?: string;
}

export const JPEG_CONTENT_TYPE = "image/jpeg";
export const PNG_CONTENT_TYPE = "image/png";
export const GIF_CONTENT_TYPE = "image/gif";

/**
 * ISO-BMFF still/sequence brands that arrive from phone cameras. `-sequence`
 * variants are HEIC too (Live Photos, burst captures) and must be transcoded,
 * not passed through.
 */
export const HEIC_CONTENT_TYPES: readonly string[] = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/heix",
  "image/hevc",
];

/** Types the pickers hand over when they do not know what a file is. */
export const UNKNOWN_CONTENT_TYPES: readonly string[] = [
  "",
  "application/octet-stream",
  "binary/octet-stream",
];

const FORMAT_CONTENT_TYPES: Record<UploadOutputFormat, string> = {
  jpeg: JPEG_CONTENT_TYPE,
  png: PNG_CONTENT_TYPE,
};

/**
 * Strip parameters, lowercase, and fold the `image/jpg` alias so allowlist
 * comparisons cannot disagree with encoder output over spelling.
 */
export function normalizeContentType(value: string | null | undefined): string {
  const base = (value ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "image/jpg" || base === "image/pjpeg") return JPEG_CONTENT_TYPE;
  return base;
}

export function contentTypeForFormat(format: UploadOutputFormat): string {
  return FORMAT_CONTENT_TYPES[format];
}

export function isUnknownContentType(value: string | null | undefined): boolean {
  return UNKNOWN_CONTENT_TYPES.includes(normalizeContentType(value));
}

export function isHeicContentType(value: string | null | undefined): boolean {
  return HEIC_CONTENT_TYPES.includes(normalizeContentType(value));
}

/** Case- and alias-insensitive allowlist membership. */
export function isAllowlistedContentType(
  value: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  const normalized = normalizeContentType(value);
  if (!normalized) return false;
  return allowlist.some((allowed) => normalizeContentType(allowed) === normalized);
}

function preferredOutputFormat(sourceContentType: string): UploadOutputFormat {
  // PNG is the only lossless output, so it is the only source family that keeps
  // its format: re-encoding a PNG as JPEG destroys the alpha channel.
  return sourceContentType === PNG_CONTENT_TYPE ? "png" : "jpeg";
}

function transcodeDecision(
  sourceContentType: string,
  allowlist: readonly string[],
  extras: Pick<UploadFormatDecision, "requiresHeicDecode" | "flattensAnimation">,
): UploadFormatDecision {
  const preferred = preferredOutputFormat(sourceContentType);
  const candidates: UploadOutputFormat[] =
    preferred === "png" ? ["png", "jpeg"] : ["jpeg", "png"];
  const outputFormat = candidates.find((format) =>
    isAllowlistedContentType(contentTypeForFormat(format), allowlist),
  );

  const sourceAllowlisted = isAllowlistedContentType(sourceContentType, allowlist);

  if (!outputFormat) {
    return {
      action: "reject",
      sourceContentType,
      sourceAllowlisted,
      requiresHeicDecode: extras.requiresHeicDecode,
      flattensAnimation: extras.flattensAnimation,
      reason: "The upload target accepts no format this client can encode.",
    };
  }

  return {
    action: "transcode",
    outputFormat,
    sourceContentType,
    sourceAllowlisted,
    requiresHeicDecode: extras.requiresHeicDecode,
    flattensAnimation:
      extras.flattensAnimation && contentTypeForFormat(outputFormat) !== sourceContentType,
  };
}

/**
 * Decide what has to happen to a source image before it can be uploaded.
 *
 * - JPEG/WebP and any other still raster source encode to JPEG.
 * - PNG stays PNG (lossless resize only — there is no "PNG quality").
 * - GIF passes through untouched when the target accepts GIF; it is never
 *   re-encoded, only size-capped, and rejects when the target excludes GIF.
 * - HEIC/HEIF in every brand, including `-sequence`, always transcodes to JPEG.
 * - Anything still unidentified after sniffing rejects with a reason.
 */
export function resolveUploadFormatPolicy(options: {
  contentType: string | null | undefined;
  allowlist: readonly string[];
}): UploadFormatDecision {
  const sourceContentType = normalizeContentType(options.contentType);
  const allowlist = options.allowlist;
  const sourceAllowlisted = isAllowlistedContentType(sourceContentType, allowlist);

  if (!sourceContentType || isUnknownContentType(sourceContentType)) {
    return {
      action: "reject",
      sourceContentType,
      sourceAllowlisted: false,
      requiresHeicDecode: false,
      flattensAnimation: false,
      reason: "The file type could not be identified.",
    };
  }

  if (!sourceContentType.startsWith("image/")) {
    return {
      action: "reject",
      sourceContentType,
      sourceAllowlisted,
      requiresHeicDecode: false,
      flattensAnimation: false,
      reason: `${sourceContentType} is not an image.`,
    };
  }

  if (isHeicContentType(sourceContentType)) {
    return transcodeDecision(sourceContentType, allowlist, {
      requiresHeicDecode: true,
      flattensAnimation: sourceContentType.endsWith("-sequence"),
    });
  }

  if (sourceContentType === GIF_CONTENT_TYPE) {
    if (sourceAllowlisted) {
      return {
        action: "passthrough",
        sourceContentType,
        sourceAllowlisted: true,
        requiresHeicDecode: false,
        flattensAnimation: false,
      };
    }
    // A GIF is animation-bearing by default and this client has no animated
    // encoder, so a target that does not accept GIF cannot be satisfied without
    // silently throwing away every frame but the first. Rejecting keeps the
    // "never re-encode an animated source" rule intact.
    return {
      action: "reject",
      sourceContentType,
      sourceAllowlisted: false,
      requiresHeicDecode: false,
      flattensAnimation: false,
      reason: "The upload target does not accept GIF, and animation cannot be re-encoded.",
    };
  }

  return transcodeDecision(sourceContentType, allowlist, {
    requiresHeicDecode: false,
    flattensAnimation: false,
  });
}

export interface UploadCandidate {
  contentType: string;
  size: number;
}

export type UploadCandidateReason =
  | "source-not-allowlisted"
  | "format-conversion"
  | "source-size-unknown"
  | "smaller"
  | "not-smaller";

export interface UploadCandidateChoice<TCandidate extends UploadCandidate> {
  chosen: TCandidate;
  /** The candidate the caller should dispose of. */
  discarded: TCandidate;
  picked: "original" | "processed";
  reason: UploadCandidateReason;
}

/**
 * Format-aware replacement for the old bytes-only "keep the original if the
 * processed file is larger" guard.
 *
 * Order matters:
 * 1. If the original's content type is not allowlisted (HEIF, WebM, …), the
 *    processed result is the only uploadable representation — size is
 *    irrelevant and the conversion always wins.
 * 2. Otherwise size decides, even across a format change (WebP→JPEG): both
 *    candidates are servable, so uploading the bigger one buys nothing. WebP
 *    displays everywhere that matters (Chrome, Firefox 65+, Edge 18+,
 *    Safari/iOS 14+, Android 4+, expo-image on both platforms), so an
 *    already-WebP source that re-encodes larger keeps its bytes. The
 *    processed file must be strictly smaller — an equal-size re-encode buys
 *    nothing. A source of unknown size (native pickers often omit
 *    `fileSize`) cannot lose that comparison, so the processed result wins
 *    by default.
 */
export function chooseUploadCandidate<TCandidate extends UploadCandidate>(
  original: TCandidate,
  processed: TCandidate,
  allowlist: readonly string[],
  options?: {
    /**
     * The processing step was a compatibility conversion (WebM→MP4): the
     * original may be allowlisted for upload yet still unplayable on major
     * platforms, so the converted result wins regardless of size.
     */
    conversionRequired?: boolean;
  },
): UploadCandidateChoice<TCandidate> {
  const originalType = normalizeContentType(original.contentType);

  if (!isAllowlistedContentType(originalType, allowlist)) {
    return {
      chosen: processed,
      discarded: original,
      picked: "processed",
      reason: "source-not-allowlisted",
    };
  }

  if (options?.conversionRequired) {
    return {
      chosen: processed,
      discarded: original,
      picked: "processed",
      reason: "format-conversion",
    };
  }

  if (!(original.size > 0)) {
    return {
      chosen: processed,
      discarded: original,
      picked: "processed",
      reason: "source-size-unknown",
    };
  }

  if (processed.size < original.size) {
    return { chosen: processed, discarded: original, picked: "processed", reason: "smaller" };
  }

  return { chosen: original, discarded: processed, picked: "original", reason: "not-smaller" };
}
