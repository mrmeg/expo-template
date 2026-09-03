/**
 * Client-side media processing.
 *
 * `processAsset` is the entry point: one orchestrator whose result always
 * carries a content type the server allowlist accepts, or which throws a typed
 * `MediaProcessingError` the UI can show against the offending asset.
 */
export { processAsset } from "./processAsset";
export type { ContentTypeAllowlist, ProcessAssetInput, ProcessAssetOptions, ProcessedThumbnail, ProcessedUpload, ProcessedUploadKind, ProcessingPhase, } from "./processAsset";
export type { ImagePlatformAdapter } from "./adapter";
export { MediaProcessingError, isMediaProcessingError, type MediaProcessingErrorCode, } from "./errors";
export { GIF_CONTENT_TYPE, HEIC_CONTENT_TYPES, JPEG_CONTENT_TYPE, PNG_CONTENT_TYPE, UNKNOWN_CONTENT_TYPES, chooseUploadCandidate, contentTypeForFormat, isAllowlistedContentType, isHeicContentType, isUnknownContentType, normalizeContentType, resolveUploadFormatPolicy, type UploadCandidate, type UploadCandidateChoice, type UploadCandidateReason, type UploadFormatDecision, type UploadOutputFormat, type UploadPolicyAction, } from "./uploadPolicy";
export { SNIFF_BYTE_COUNT, contentTypeFromFileName, resolveSourceContentType, sniffContentTypeFromBytes, } from "./sniff";
export { mapWithConcurrency } from "./concurrency";
export { logMediaDebug } from "./logger";
export { CANVAS_LIMIT_CHROMIUM, CANVAS_LIMIT_DEFAULT, CANVAS_LIMIT_FIREFOX, CANVAS_LIMIT_IOS, DEFAULT_PRESET as DEFAULT_IMAGE_PRESET, IMAGE_PRESETS, calculateDimensions, canvasLongEdgeLimitFor, clampLongEdgeToCanvasLimit, compressImage, compressImageWith, convertHeicToJpeg, convertHeicToJpegIfNeeded, formatFileSize, hasHeicExtension, imagePlatformAdapter, isHeicBlob, longEdgeOf, resolveCompressionConfig, resolveLadderRungs, runDimensionLadder, type CompressedImage, type CompressImageOptions, type CompressionConfig, type DisposeEncodedImage, type EncodedImage, type EncodeImage, type EncodeImageOptions, type ImagePreset, type ImageSource, } from "./imageCompression";
export { CONVERSION_PRESETS, DEFAULT_PRESET as DEFAULT_VIDEO_CONVERSION_PRESET, FFMPEG_WORKER_URL, MAX_CLIENT_CONVERSION_SIZE, convertVideo, estimateConversionTime, getFormatFromMimeType, isFFmpegLoaded, needsConversion, preloadFFmpeg, FORMATS_NEEDING_CONVERSION, TARGET_FORMAT, TARGET_MIME_TYPE, FFmpegWorkerUnavailableError, type VideoConversionConfig, type VideoConversionOptions, type VideoConversionPreset, type VideoConversionResult, } from "./videoConversion";
export { extractVideoThumbnail, type ThumbnailResult, } from "./videoThumbnails";
