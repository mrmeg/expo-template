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

import { logMediaDebug as logDev } from "../logger";
import { MediaProcessingError } from "../errors";
import { SNIFF_BYTE_COUNT, sniffContentTypeFromBytes } from "../sniff";
import {
  JPEG_CONTENT_TYPE,
  isHeicContentType,
  isUnknownContentType,
} from "../uploadPolicy";
import { formatFileSize } from "./utils";

/** Quality for the HEIC→JPEG decode hop. High: the ladder re-encodes after it. */
const HEIC_DECODE_QUALITY = 0.92;

/** File extensions that mean HEIF regardless of what the picker declared. */
const HEIC_EXTENSION = /\.(heic|heif|hif)$/i;

export function hasHeicExtension(fileName: string | null | undefined): boolean {
  return Boolean(fileName && HEIC_EXTENSION.test(fileName.trim()));
}

/** Read just enough of a blob for the ISO-BMFF `ftyp` box. */
export async function readLeadingBytes(
  blob: Blob,
  count = SNIFF_BYTE_COUNT,
): Promise<Uint8Array> {
  const slice = blob.slice(0, count);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Decide whether a blob is HEIF.
 *
 * Three independent signals, in descending trust: a HEIC content type, a HEIC
 * file extension, and — only when the declared type is blank or
 * `application/octet-stream`, which is how iOS Safari hands over camera-roll
 * shares — an ISO-BMFF brand sniff of the first 12 bytes.
 */
export async function isHeicBlob(blob: Blob, fileName?: string): Promise<boolean> {
  if (isHeicContentType(blob.type)) return true;
  if (hasHeicExtension(fileName)) return true;
  if (!isUnknownContentType(blob.type)) return false;

  try {
    const sniffed = sniffContentTypeFromBytes(await readLeadingBytes(blob));
    return isHeicContentType(sniffed);
  } catch {
    return false;
  }
}

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
 * Load `heic2any` on first use. Optional peer, MIT, ~1 MB — keeping the import
 * dynamic is what keeps it out of the eager web bundle.
 */
const lazyHeicDecoder: HeicDecoder = async (options) => {
  const heic2any = await import("heic2any");
  return heic2any.default(options);
};

/**
 * Convert a HEIF blob to JPEG. Throws `MediaProcessingError` with code
 * `heic-conversion-failed` when the decoder cannot handle the file — the caller
 * surfaces that per asset instead of uploading bytes the server will refuse.
 */
export async function convertHeicToJpeg(
  blob: Blob,
  fileName?: string,
  decoder: HeicDecoder = lazyHeicDecoder,
): Promise<Blob> {
  logDev(
    `Converting HEIC to JPEG: ${formatFileSize(blob.size)}${fileName ? ` (${fileName})` : ""}`,
  );

  let converted: unknown;
  try {
    converted = await decoder({
      blob,
      toType: JPEG_CONTENT_TYPE,
      quality: HEIC_DECODE_QUALITY,
    });
  } catch (error) {
    throw new MediaProcessingError(
      "heic-conversion-failed",
      "Could not read this HEIC photo.",
      { contentType: blob.type, cause: error },
    );
  }

  // heic2any returns Blob[] for multi-image files (bursts, Live Photos).
  const result = Array.isArray(converted) ? converted[0] : converted;
  if (!(result instanceof Blob) || result.size === 0) {
    throw new MediaProcessingError(
      "heic-conversion-failed",
      "HEIC conversion produced no image data.",
      { contentType: blob.type },
    );
  }

  logDev(`HEIC conversion complete: ${formatFileSize(blob.size)} -> ${formatFileSize(result.size)}`);

  // heic2any sets the type from `toType`, but normalise defensively: everything
  // downstream reads `blob.type` as the authority.
  return result.type === JPEG_CONTENT_TYPE
    ? result
    : new Blob([result], { type: JPEG_CONTENT_TYPE });
}

/**
 * Convert only when the blob really is HEIF; otherwise hand the blob back
 * untouched. Kept as a convenience for callers that have not already asked the
 * upload policy.
 */
export async function convertHeicToJpegIfNeeded(
  blob: Blob,
  fileName?: string,
  decoder: HeicDecoder = lazyHeicDecoder,
): Promise<Blob> {
  if (!(await isHeicBlob(blob, fileName))) return blob;
  return convertHeicToJpeg(blob, fileName, decoder);
}
