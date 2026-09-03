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
export declare const JPEG_CONTENT_TYPE = "image/jpeg";
export declare const PNG_CONTENT_TYPE = "image/png";
export declare const GIF_CONTENT_TYPE = "image/gif";
/**
 * ISO-BMFF still/sequence brands that arrive from phone cameras. `-sequence`
 * variants are HEIC too (Live Photos, burst captures) and must be transcoded,
 * not passed through.
 */
export declare const HEIC_CONTENT_TYPES: readonly string[];
/** Types the pickers hand over when they do not know what a file is. */
export declare const UNKNOWN_CONTENT_TYPES: readonly string[];
/**
 * Strip parameters, lowercase, and fold the `image/jpg` alias so allowlist
 * comparisons cannot disagree with encoder output over spelling.
 */
export declare function normalizeContentType(value: string | null | undefined): string;
export declare function contentTypeForFormat(format: UploadOutputFormat): string;
export declare function isUnknownContentType(value: string | null | undefined): boolean;
export declare function isHeicContentType(value: string | null | undefined): boolean;
/** Case- and alias-insensitive allowlist membership. */
export declare function isAllowlistedContentType(value: string | null | undefined, allowlist: readonly string[]): boolean;
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
export declare function resolveUploadFormatPolicy(options: {
    contentType: string | null | undefined;
    allowlist: readonly string[];
}): UploadFormatDecision;
export interface UploadCandidate {
    contentType: string;
    size: number;
}
export type UploadCandidateReason = "source-not-allowlisted" | "format-conversion" | "source-size-unknown" | "smaller" | "not-smaller";
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
 * 1. If the original's content type is not allowlisted, the processed result is
 *    the only uploadable representation — size is irrelevant.
 * 2. A format conversion (HEIF→JPEG, WebM→MP4) always wins for the same
 *    reason: the comparison is not like-for-like.
 * 3. Only for a same-format re-encode does size decide, and the processed file
 *    must be strictly smaller — an equal-size re-encode buys nothing. A source
 *    of unknown size (native pickers often omit `fileSize`) cannot lose that
 *    comparison, so the processed result wins by default.
 */
export declare function chooseUploadCandidate<TCandidate extends UploadCandidate>(original: TCandidate, processed: TCandidate, allowlist: readonly string[]): UploadCandidateChoice<TCandidate>;
