/**
 * Typed failures the client pipeline can surface per asset.
 *
 * Processing never silently falls back to bytes the server would reject, so
 * every dead end below is an error the UI shows against the asset that caused
 * it instead of a mystery `400 invalid-content-type` at upload time.
 */

export type MediaProcessingErrorCode =
  /** The source content type could not be identified or cannot be uploaded. */
  | "unsupported-format"
  /** Web HEIC → JPEG conversion failed; the HEIF bytes are never a fallback. */
  | "heic-conversion-failed"
  /** The platform could not decode the source image. */
  | "decode-failed"
  /** The platform encoder produced no output. */
  | "encode-failed"
  /** The encoded file could not be measured, so it cannot be compared or sized. */
  | "stat-failed";

export class MediaProcessingError extends Error {
  readonly code: MediaProcessingErrorCode;
  /** Normalized content type of the offending source, when known. */
  readonly contentType?: string;
  readonly cause?: unknown;

  constructor(
    code: MediaProcessingErrorCode,
    message: string,
    options: { contentType?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "MediaProcessingError";
    this.code = code;
    this.contentType = options.contentType;
    this.cause = options.cause;
  }
}

export function isMediaProcessingError(value: unknown): value is MediaProcessingError {
  return value instanceof MediaProcessingError;
}
