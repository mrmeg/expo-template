/**
 * HEIC to JPEG conversion for web browsers.
 * Native platforms handle HEIC natively via expo-image-manipulator.
 */
/**
 * Convert HEIC/HEIF images to JPEG (Web only).
 *
 * On web browsers, HEIC images are not natively supported, so we use
 * the heic2any library to convert them to JPEG before processing.
 *
 * On native platforms (iOS/Android), the system handles HEIC natively,
 * so this function simply returns the original blob unchanged.
 *
 * @param blob - The image blob to potentially convert
 * @param fileName - Optional filename to help detect HEIC by extension
 * @returns The original blob (native) or converted JPEG blob (web)
 */
export declare function convertHeicToJpeg(blob: Blob, fileName?: string): Promise<Blob>;
