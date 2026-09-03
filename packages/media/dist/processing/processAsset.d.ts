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
import type { ImagePlatformAdapter } from "./adapter";
import type { CompressionConfig } from "./imageCompression/config";
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
export type ProcessingPhase = {
    type: "identifying";
} | {
    type: "decoding-heic";
} | {
    type: "compressing";
} | {
    type: "passthrough";
} | {
    type: "converting-video";
    progress?: number;
    loadingConverter?: boolean;
} | {
    type: "extracting-thumbnail";
} | {
    type: "complete";
};
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
/**
 * Process one picked asset into an uploadable result.
 *
 * @throws {MediaProcessingError} When the asset cannot be represented as an
 * allowlisted content type — the caller shows this against the asset instead of
 * discovering it as a server `400 invalid-content-type`.
 */
export declare function processAsset(options: ProcessAssetOptions): Promise<ProcessedUpload>;
