/**
 * Typed failures the client pipeline can surface per asset.
 *
 * Processing never silently falls back to bytes the server would reject, so
 * every dead end below is an error the UI shows against the asset that caused
 * it instead of a mystery `400 invalid-content-type` at upload time.
 */
export class MediaProcessingError extends Error {
    code;
    /** Normalized content type of the offending source, when known. */
    contentType;
    cause;
    constructor(code, message, options = {}) {
        super(message);
        this.name = "MediaProcessingError";
        this.code = code;
        this.contentType = options.contentType;
        this.cause = options.cause;
    }
}
export function isMediaProcessingError(value) {
    return value instanceof MediaProcessingError;
}
