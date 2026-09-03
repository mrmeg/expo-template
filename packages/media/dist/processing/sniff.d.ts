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
/** Number of leading bytes the sniffer needs. ISO-BMFF `ftyp` needs 12. */
export declare const SNIFF_BYTE_COUNT = 12;
/**
 * Identify a file from its leading bytes. Returns `null` when the bytes match no
 * known container — the caller must then reject rather than guess.
 */
export declare function sniffContentTypeFromBytes(bytes: Uint8Array | null | undefined): string | null;
/**
 * Identify a file from its name. Weaker evidence than bytes, but it is all
 * native has without reading the file.
 */
export declare function contentTypeFromFileName(fileName: string | null | undefined): string | null;
/**
 * Best identification available from a declared type, a name, and optional
 * bytes.
 *
 * A specific declared type is trusted as-is; only a blank or opaque declaration
 * falls through to the evidence, where bytes beat the file name. Returns `null`
 * when nothing identifies the file, which the policy turns into a rejection.
 */
export declare function resolveSourceContentType(input: {
    declared?: string | null;
    fileName?: string | null;
    bytes?: Uint8Array | null;
}): string | null;
