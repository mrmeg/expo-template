/**
 * Content-type sniffing.
 *
 * Pickers lie: iOS shares HEIC as `application/octet-stream`, some Android
 * providers hand over a blank type, and a few browsers report nothing for
 * `File`s dragged in from disk. Since the upload policy rejects anything it
 * cannot identify, the pipeline gets one chance to identify it properly — from
 * the first bytes (authoritative) or the file name (a hint).
 *
 * Pure and byte-oriented so it can be tested without a DOM or a filesystem.
 */
import { isUnknownContentType, normalizeContentType } from "./uploadPolicy.js";
/** Number of leading bytes the sniffer needs. ISO-BMFF `ftyp` needs 12. */
export const SNIFF_BYTE_COUNT = 12;
const HEIC_BRANDS = new Set([
    "heic",
    "heix",
    "heim",
    "heis",
    "hevc",
    "hevx",
    "hevm",
    "hevs",
    "mif1",
    "msf1",
    "heif",
]);
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash"]);
function matches(bytes, offset, signature) {
    if (bytes.length < offset + signature.length)
        return false;
    return signature.every((byte, index) => bytes[offset + index] === byte);
}
function ascii(bytes, offset, length) {
    if (bytes.length < offset + length)
        return "";
    let out = "";
    for (let index = offset; index < offset + length; index += 1) {
        out += String.fromCharCode(bytes[index]);
    }
    return out;
}
/**
 * Identify a file from its leading bytes. Returns `null` when the bytes match no
 * known container — the caller must then reject rather than guess.
 */
export function sniffContentTypeFromBytes(bytes) {
    if (!bytes || bytes.length < 4)
        return null;
    // JPEG: FF D8 FF
    if (matches(bytes, 0, [0xff, 0xd8, 0xff]))
        return "image/jpeg";
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47]))
        return "image/png";
    // GIF87a / GIF89a
    if (ascii(bytes, 0, 3) === "GIF")
        return "image/gif";
    // RIFF....WEBP
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
        return "image/webp";
    // BMP
    if (ascii(bytes, 0, 2) === "BM")
        return "image/bmp";
    // EBML — Matroska/WebM
    if (matches(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]))
        return "video/webm";
    // ISO base media file format: [4-byte size]"ftyp"[4-byte brand]
    if (ascii(bytes, 4, 4) === "ftyp") {
        const brand = ascii(bytes, 8, 4).toLowerCase().trim();
        if (HEIC_BRANDS.has(brand)) {
            // `msf1` is the image *sequence* brand; the still brands are all HEIC.
            return brand === "msf1" ? "image/heic-sequence" : "image/heic";
        }
        if (brand === "qt")
            return "video/quicktime";
        if (MP4_BRANDS.has(brand))
            return "video/mp4";
        // Unknown ISO-BMFF brand: still a container we cannot name confidently.
        return null;
    }
    return null;
}
const EXTENSION_CONTENT_TYPES = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    heic: "image/heic",
    heif: "image/heif",
    hif: "image/heif",
    avif: "image/avif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    qt: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
};
/**
 * Identify a file from its name. Weaker evidence than bytes, but it is all
 * native has without reading the file.
 */
export function contentTypeFromFileName(fileName) {
    if (!fileName)
        return null;
    const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
    const extension = match?.[1]?.toLowerCase();
    if (!extension)
        return null;
    return EXTENSION_CONTENT_TYPES[extension] ?? null;
}
/**
 * Best identification available from a declared type, a name, and optional
 * bytes.
 *
 * A specific declared type is trusted as-is; only a blank or opaque declaration
 * falls through to the evidence, where bytes beat the file name. Returns `null`
 * when nothing identifies the file, which the policy turns into a rejection.
 */
export function resolveSourceContentType(input) {
    const declared = normalizeContentType(input.declared);
    if (declared && !isUnknownContentType(declared))
        return declared;
    return (sniffContentTypeFromBytes(input.bytes) ?? contentTypeFromFileName(input.fileName));
}
