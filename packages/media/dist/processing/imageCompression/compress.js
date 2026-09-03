/**
 * Web image encoding (Canvas API). Metro resolves this file for web only.
 *
 * This is the encode *primitive* plus the platform adapter — one rung, one call.
 * All ladder logic lives in `ladder.ts` so both platforms share it.
 *
 * Two web-specific hazards are handled here:
 * - Canvas ceilings: a canvas above the engine's limit draws blank instead of
 *   throwing, so target dimensions are clamped before drawing.
 * - `toBlob` type substitution: Safari answers an unsupported request (WebP)
 *   with PNG and says nothing, so the output's `Blob.type` is read back rather
 *   than assumed. The client never requests WebP either way.
 */
import { MediaProcessingError } from "../errors.js";
import { logMediaDebug as logDev } from "../logger.js";
import { SNIFF_BYTE_COUNT, sniffContentTypeFromBytes } from "../sniff.js";
import { contentTypeForFormat } from "../uploadPolicy.js";
import { clampLongEdgeToCanvasLimit, currentCanvasLongEdgeLimit, } from "./canvasLimits.js";
import { compressImageWith } from "./compressImage.js";
import { convertHeicToJpeg } from "./heicConvert.js";
import { calculateDimensions, formatFileSize } from "./utils.js";
async function blobFor(source) {
    if (source.blob)
        return source.blob;
    try {
        const response = await fetch(source.uri);
        return await response.blob();
    }
    catch (error) {
        throw new MediaProcessingError("decode-failed", "Could not read the selected image.", {
            cause: error,
        });
    }
}
/**
 * Decode into an `HTMLImageElement`. Modern engines apply EXIF orientation while
 * decoding (`image-orientation: from-image` is the CSS default), so
 * `naturalWidth`/`naturalHeight` are already the displayed dimensions.
 */
async function loadImage(source) {
    const objectUrl = source.blob ? URL.createObjectURL(source.blob) : null;
    const src = objectUrl ?? source.uri;
    const release = () => {
        if (objectUrl)
            URL.revokeObjectURL(objectUrl);
    };
    try {
        const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.crossOrigin = "anonymous";
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error(`Image decode failed for ${source.uri}`));
            element.src = src;
        });
        return { image, release };
    }
    catch (error) {
        release();
        throw new MediaProcessingError("decode-failed", "This image could not be decoded.", {
            cause: error,
        });
    }
}
function canvasToBlob(canvas, contentType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob && blob.size > 0)
                resolve(blob);
            else
                reject(new MediaProcessingError("encode-failed", "The image encoder produced no data."));
        }, contentType, quality);
    });
}
/** One rung: decode, clamp, draw, encode, wrap. */
export async function encodeImageWeb(options) {
    const { source, longEdge, quality, format } = options;
    const { image, release } = await loadImage(source);
    try {
        const sourceWidth = image.naturalWidth || options.width;
        const sourceHeight = image.naturalHeight || options.height;
        const limit = currentCanvasLongEdgeLimit();
        const cap = clampLongEdgeToCanvasLimit(longEdge, limit);
        if (cap !== longEdge) {
            logDev(`Clamped ${longEdge}px target to the ${limit}px canvas limit`);
        }
        const { targetWidth, targetHeight } = calculateDimensions(sourceWidth, sourceHeight, cap);
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new MediaProcessingError("encode-failed", "Canvas 2D is unavailable.");
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        const requested = contentTypeForFormat(format);
        const blob = await canvasToBlob(canvas, requested, quality);
        // Trust the output, not the request.
        const contentType = blob.type || requested;
        return {
            uri: URL.createObjectURL(blob),
            blob,
            width: targetWidth,
            height: targetHeight,
            contentType,
            size: blob.size,
        };
    }
    finally {
        release();
    }
}
export function disposeEncodedImageWeb(image) {
    if (image.uri.startsWith("blob:")) {
        URL.revokeObjectURL(image.uri);
    }
}
async function measureWeb(source) {
    const blob = await blobFor(source);
    if (!(blob.size > 0)) {
        throw new MediaProcessingError("stat-failed", "The selected file is empty.");
    }
    return blob.size;
}
async function probeDimensionsWeb(source) {
    const { image, release } = await loadImage(source);
    try {
        return { width: image.naturalWidth, height: image.naturalHeight };
    }
    finally {
        release();
    }
}
async function sniffContentTypeWeb(source, fileName) {
    try {
        const blob = await blobFor(source);
        const bytes = new Uint8Array(await blob.slice(0, SNIFF_BYTE_COUNT).arrayBuffer());
        return sniffContentTypeFromBytes(bytes);
    }
    catch {
        logDev(`Content-type sniff failed for ${fileName ?? source.uri}`);
        return null;
    }
}
async function decodeHeicWeb(source, fileName) {
    const blob = await blobFor(source);
    const converted = await convertHeicToJpeg(blob, fileName);
    logDev(`HEIC decoded for pipeline: ${formatFileSize(converted.size)}`);
    return { uri: URL.createObjectURL(converted), blob: converted };
}
export const imagePlatformAdapter = {
    encode: encodeImageWeb,
    dispose: disposeEncodedImageWeb,
    measure: measureWeb,
    probeDimensions: probeDimensionsWeb,
    sniffContentType: sniffContentTypeWeb,
    decodeHeic: decodeHeicWeb,
};
/**
 * Run the dimension ladder on this platform.
 *
 * @returns The winning rung, flagged `overBudget` when even the smallest rung
 * missed the byte budget.
 */
export function compressImage(options) {
    return compressImageWith(imagePlatformAdapter, options);
}
