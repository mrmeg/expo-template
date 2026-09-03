/**
 * HEIC/HEIF decoding for the web.
 *
 * Browsers cannot decode HEIF (Safari can display it but `canvas.drawImage`
 * still fails for the sequence brands), so the web pipeline converts to JPEG
 * first via `heic2any` — MIT, an optional peer dependency, lazily imported so
 * the ~1 MB decoder never lands in the eager bundle. `libheif-js` is LGPL-3.0
 * and deliberately not used.
 *
 * Native needs none of this: `expo-image-manipulator` decodes HEIC on both
 * platforms.
 *
 * Failure is loud. The previous implementation returned the un-converted HEIF
 * bytes on error, which is exactly how an unuploadable content type reached the
 * server.
 */
export declare function hasHeicExtension(fileName: string | null | undefined): boolean;
/** Read just enough of a blob for the ISO-BMFF `ftyp` box. */
export declare function readLeadingBytes(blob: Blob, count?: number): Promise<Uint8Array>;
/**
 * Decide whether a blob is HEIF.
 *
 * Three independent signals, in descending trust: a HEIC content type, a HEIC
 * file extension, and — only when the declared type is blank or
 * `application/octet-stream`, which is how iOS Safari hands over camera-roll
 * shares — an ISO-BMFF brand sniff of the first 12 bytes.
 */
export declare function isHeicBlob(blob: Blob, fileName?: string): Promise<boolean>;
/**
 * The one call this module makes into `heic2any`. Injectable for the same reason
 * `videoThumbnailNative` takes its native modules as arguments: the lazy
 * `import()` is a bundler concern that cannot run under a plain test runner.
 */
export type HeicDecoder = (options: {
    blob: Blob;
    toType: string;
    quality: number;
}) => Promise<unknown>;
/**
 * Convert a HEIF blob to JPEG. Throws `MediaProcessingError` with code
 * `heic-conversion-failed` when the decoder cannot handle the file — the caller
 * surfaces that per asset instead of uploading bytes the server will refuse.
 */
export declare function convertHeicToJpeg(blob: Blob, fileName?: string, decoder?: HeicDecoder): Promise<Blob>;
/**
 * Convert only when the blob really is HEIF; otherwise hand the blob back
 * untouched. Kept as a convenience for callers that have not already asked the
 * upload policy.
 */
export declare function convertHeicToJpegIfNeeded(blob: Blob, fileName?: string, decoder?: HeicDecoder): Promise<Blob>;
