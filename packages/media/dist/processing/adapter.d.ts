/**
 * The platform seam.
 *
 * Everything platform-specific about image processing is reachable through this
 * one interface: probe, sniff, HEIC decode, encode, measure, release. The
 * orchestrator and the ladder are then plain functions that can be tested on
 * either platform's behaviour with a fake adapter — which matters here because
 * Metro's `.native.ts` resolution means a test process only ever sees one of the
 * two real implementations.
 */
import type { DisposeEncodedImage, EncodeImage, ImageSource } from "./imageCompression/types";
export interface ImagePlatformAdapter {
    /** Encode one ladder rung. */
    encode: EncodeImage;
    /** Release an encode result (delete temp file / revoke object URL). */
    dispose: DisposeEncodedImage;
    /**
     * Byte size of a source. Throws `MediaProcessingError` with code
     * `stat-failed` rather than reporting `0`, which would corrupt every
     * size comparison downstream.
     */
    measure(source: ImageSource): Promise<number>;
    /** Pixel dimensions of a source, used when the picker did not supply them. */
    probeDimensions(source: ImageSource): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Identify a source whose declared content type is blank or
     * `application/octet-stream`. Returns `null` when it cannot be identified.
     */
    sniffContentType(source: ImageSource, fileName?: string): Promise<string | null>;
    /**
     * Decode HEIF into a JPEG source. Absent on native, where the platform
     * decoder reads HEIF directly.
     */
    decodeHeic?(source: ImageSource, fileName?: string): Promise<ImageSource>;
}
