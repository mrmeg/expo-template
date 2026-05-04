/**
 * Native stub for video conversion
 *
 * Client-side video conversion is not supported in Expo managed workflow.
 * Native apps should upload videos in their original format.
 *
 * For formats that need conversion (WebM, etc.), consider:
 * 1. Server-side conversion via Cloudflare Stream or similar
 * 2. Adding a custom native client with native FFmpeg bindings
 * 3. Restricting video picker to MP4/MOV formats on native
 */
/**
 * Shape-compatible stub of the web-only typed error. Native never loads a
 * worker, but exporting the class keeps `instanceof` checks in shared
 * consumer code (useMediaLibrary) platform-safe.
 */
export class FFmpegWorkerUnavailableError extends Error {
    url;
    status;
    constructor(url, status, message) {
        super(message ?? `FFmpeg worker not available at ${url}`);
        this.name = "FFmpegWorkerUnavailableError";
        this.url = url;
        this.status = status;
    }
}
/**
 * Convert video - NOT SUPPORTED on native
 * @throws Error always - native conversion not available
 */
export async function convertVideo(_uri, _originalMimeType, _options) {
    throw new Error("Client-side video conversion is not supported on native platforms. " +
        "Videos will be uploaded in their original format. " +
        "Consider using server-side conversion for incompatible formats.");
}
/**
 * Check if FFmpeg is loaded - always false on native
 */
export function isFFmpegLoaded() {
    return false;
}
/**
 * Preload FFmpeg - no-op on native
 */
export async function preloadFFmpeg() {
    // No-op on native
}
