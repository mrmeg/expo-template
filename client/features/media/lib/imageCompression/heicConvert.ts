/**
 * HEIC to JPEG conversion for web browsers.
 * Native platforms handle HEIC natively via expo-image-manipulator.
 */

import { Platform } from "react-native";
import { logDev } from "@/client/devtools";

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
export async function convertHeicToJpeg(
  blob: Blob,
  fileName?: string
): Promise<Blob> {
  // Only run on web - native platforms handle HEIC natively
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return blob;
  }

  const hasHeicMimeType =
    blob.type === "image/heic" || blob.type === "image/heif";
  const hasHeicExtension = fileName && /\.(heic|heif)$/i.test(fileName);
  const hasUnknownMimeType =
    blob.type === "" || blob.type === "application/octet-stream";

  const isHeic = hasHeicMimeType || (hasUnknownMimeType && hasHeicExtension);

  if (!isHeic) {
    return blob;
  }

  logDev(
    `Converting HEIC to JPEG: ${(blob.size / 1024 / 1024).toFixed(2)}MB${fileName ? ` (${fileName})` : ""}`
  );

  try {
    const heic2any = await import("heic2any");

    const convertedBlob = (await heic2any.default({
      blob,
      toType: "image/jpeg",
      quality: 0.92,
    })) as Blob;

    logDev(
      `HEIC conversion complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB -> ${(convertedBlob.size / 1024 / 1024).toFixed(2)}MB`
    );

    return convertedBlob;
  } catch (error) {
    logDev(`HEIC conversion failed, using original: ${error}`);
    return blob;
  }
}
