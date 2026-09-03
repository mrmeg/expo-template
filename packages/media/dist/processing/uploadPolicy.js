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
export const JPEG_CONTENT_TYPE = "image/jpeg";
export const PNG_CONTENT_TYPE = "image/png";
export const GIF_CONTENT_TYPE = "image/gif";
/**
 * ISO-BMFF still/sequence brands that arrive from phone cameras. `-sequence`
 * variants are HEIC too (Live Photos, burst captures) and must be transcoded,
 * not passed through.
 */
export const HEIC_CONTENT_TYPES = [
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/heix",
    "image/hevc",
];
/** Types the pickers hand over when they do not know what a file is. */
export const UNKNOWN_CONTENT_TYPES = [
    "",
    "application/octet-stream",
    "binary/octet-stream",
];
const FORMAT_CONTENT_TYPES = {
    jpeg: JPEG_CONTENT_TYPE,
    png: PNG_CONTENT_TYPE,
};
/**
 * Strip parameters, lowercase, and fold the `image/jpg` alias so allowlist
 * comparisons cannot disagree with encoder output over spelling.
 */
export function normalizeContentType(value) {
    const base = (value ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
    if (base === "image/jpg" || base === "image/pjpeg")
        return JPEG_CONTENT_TYPE;
    return base;
}
export function contentTypeForFormat(format) {
    return FORMAT_CONTENT_TYPES[format];
}
export function isUnknownContentType(value) {
    return UNKNOWN_CONTENT_TYPES.includes(normalizeContentType(value));
}
export function isHeicContentType(value) {
    return HEIC_CONTENT_TYPES.includes(normalizeContentType(value));
}
/** Case- and alias-insensitive allowlist membership. */
export function isAllowlistedContentType(value, allowlist) {
    const normalized = normalizeContentType(value);
    if (!normalized)
        return false;
    return allowlist.some((allowed) => normalizeContentType(allowed) === normalized);
}
function preferredOutputFormat(sourceContentType) {
    // PNG is the only lossless output, so it is the only source family that keeps
    // its format: re-encoding a PNG as JPEG destroys the alpha channel.
    return sourceContentType === PNG_CONTENT_TYPE ? "png" : "jpeg";
}
function transcodeDecision(sourceContentType, allowlist, extras) {
    const preferred = preferredOutputFormat(sourceContentType);
    const candidates = preferred === "png" ? ["png", "jpeg"] : ["jpeg", "png"];
    const outputFormat = candidates.find((format) => isAllowlistedContentType(contentTypeForFormat(format), allowlist));
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
        flattensAnimation: extras.flattensAnimation && contentTypeForFormat(outputFormat) !== sourceContentType,
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
export function resolveUploadFormatPolicy(options) {
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
export function chooseUploadCandidate(original, processed, allowlist) {
    const originalType = normalizeContentType(original.contentType);
    const processedType = normalizeContentType(processed.contentType);
    if (!isAllowlistedContentType(originalType, allowlist)) {
        return {
            chosen: processed,
            discarded: original,
            picked: "processed",
            reason: "source-not-allowlisted",
        };
    }
    if (originalType !== processedType) {
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
