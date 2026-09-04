/**
 * Native image encoding (expo-image-manipulator). Metro resolves this file for
 * iOS and Android.
 *
 * This is the encode *primitive* plus the platform adapter — one rung, one call.
 * All ladder logic lives in `ladder.ts` so both platforms share it.
 *
 * Two native-specific hazards are handled here:
 * - Handles: `manipulate()` and `renderAsync()` both allocate native bitmaps
 *   that must be `release()`d, or a 20-photo batch holds 20 full-resolution
 *   bitmaps and gets the app killed.
 * - Stat: a failed `File.size` read is an error. Reporting `0` (as the previous
 *   implementation did) makes every size comparison downstream wrong.
 */
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { MediaProcessingError } from "../errors.js";
import { contentTypeForFormat } from "../uploadPolicy.js";
import { contentTypeFromFileName } from "../sniff.js";
import { compressImageWith } from "./compressImage.js";
import { calculateDimensions } from "./utils.js";
function saveFormatFor(format) {
    return format === "png" ? SaveFormat.PNG : SaveFormat.JPEG;
}
/**
 * Byte size of a file URI. Throws rather than returning `0`: an unmeasurable
 * encode cannot be compared against the source or checked against the budget.
 */
export function statSize(uri) {
    let size;
    try {
        size = new File(uri).size;
    }
    catch (error) {
        throw new MediaProcessingError("stat-failed", `Could not read the size of ${uri}.`, {
            cause: error,
        });
    }
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
        throw new MediaProcessingError("stat-failed", `Could not read the size of ${uri}.`);
    }
    return size;
}
/** One rung: manipulate, render, save, stat, release everything. */
export async function encodeImageNative(options) {
    const { source, longEdge, quality, format } = options;
    const { targetWidth, targetHeight } = calculateDimensions(options.width, options.height, longEdge);
    const context = ImageManipulator.manipulate(source.uri);
    try {
        if (targetWidth > 0 &&
            targetHeight > 0 &&
            (targetWidth !== options.width || targetHeight !== options.height)) {
            context.resize({ width: targetWidth, height: targetHeight });
        }
        const rendered = await context.renderAsync();
        try {
            const saved = await rendered.saveAsync({
                format: saveFormatFor(format),
                compress: quality,
            });
            if (!saved?.uri) {
                throw new MediaProcessingError("encode-failed", "The image encoder produced no file.");
            }
            return {
                uri: saved.uri,
                width: saved.width ?? targetWidth,
                height: saved.height ?? targetHeight,
                // The manipulator writes exactly the requested format, and there is no
                // blob to read a type off, so the request is the authority here.
                contentType: contentTypeForFormat(format),
                size: statSize(saved.uri),
            };
        }
        finally {
            rendered.release();
        }
    }
    finally {
        context.release();
    }
}
export function disposeEncodedImageNative(image) {
    try {
        const file = new File(image.uri);
        if (file.exists)
            file.delete();
    }
    catch {
        // A leftover cache file is harmless; the OS reclaims it. Failing the upload
        // over a failed cleanup would not be.
    }
}
async function measureNative(source) {
    return statSize(source.uri);
}
async function probeDimensionsNative(source) {
    const context = ImageManipulator.manipulate(source.uri);
    try {
        const rendered = await context.renderAsync();
        try {
            return { width: rendered.width, height: rendered.height };
        }
        finally {
            rendered.release();
        }
    }
    catch (error) {
        throw new MediaProcessingError("decode-failed", "This image could not be decoded.", {
            cause: error,
        });
    }
    finally {
        context.release();
    }
}
/**
 * Native has no cheap byte read for arbitrary content URIs, and the pickers
 * always provide a file name or a URI with an extension, so the extension is the
 * evidence used here.
 */
async function sniffContentTypeNative(source, fileName) {
    return contentTypeFromFileName(fileName) ?? contentTypeFromFileName(source.uri);
}
export const imagePlatformAdapter = {
    encode: encodeImageNative,
    dispose: disposeEncodedImageNative,
    measure: measureNative,
    probeDimensions: probeDimensionsNative,
    sniffContentType: sniffContentTypeNative,
    // No `decodeHeic`: expo-image-manipulator decodes HEIF on both platforms.
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
