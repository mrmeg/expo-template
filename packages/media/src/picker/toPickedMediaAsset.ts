import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { logMediaDebug } from "../processing/logger";
import { parseExifDate, parseExifGps, parseExifOrientation } from "./exif";
import { createPickedAssetId } from "./assetId";
import type { PickedMediaAsset, PickedMediaExif } from "./types";

/**
 * The web pipeline works on bytes and the upload needs the same `Blob`, so read
 * it once here. Native keeps working from the file URI. A failed read is not
 * fatal: `processAsset` falls back to fetching the URI itself.
 */
async function readAssetBlob(asset: ImagePickerAsset): Promise<Blob | undefined> {
  if (Platform.OS !== "web") return undefined;
  // The web picker already holds the `File`; no round trip needed.
  if (asset.file) return asset.file;
  try {
    const response = await fetch(asset.uri);
    return await response.blob();
  } catch (error) {
    logMediaDebug(`Could not read picked file bytes: ${String(error)}`);
    return undefined;
  }
}

function isVideo(asset: ImagePickerAsset): boolean {
  return asset.type === "video" || asset.mimeType?.startsWith("video/") === true;
}

function buildExif(asset: ImagePickerAsset): PickedMediaExif | undefined {
  const takenAt = parseExifDate(asset.exif);
  const gps = parseExifGps(asset.exif);
  if (!takenAt && !gps) return undefined;

  return {
    ...(takenAt ? { takenAt } : {}),
    ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
  };
}

/**
 * Reduce one `expo-image-picker` asset to a `PickedMediaAsset`.
 *
 * `index` only names a file the picker left unnamed (`file-1`, `file-2`, …).
 * `duration` arrives in milliseconds and leaves in seconds, which is what
 * `ProcessAssetInput.durationSeconds` means.
 */
export async function toPickedMediaAsset(
  asset: ImagePickerAsset,
  index: number,
): Promise<PickedMediaAsset> {
  const exif = buildExif(asset);

  return {
    id: createPickedAssetId(),
    uri: asset.uri,
    blob: await readAssetBlob(asset),
    contentType: asset.mimeType,
    fileName: asset.fileName || `file-${index + 1}`,
    width: asset.width,
    height: asset.height,
    size: asset.fileSize,
    kind: isVideo(asset) ? "video" : "image",
    durationSeconds: asset.duration ? asset.duration / 1000 : undefined,
    exifOrientation: parseExifOrientation(asset.exif),
    ...(exif ? { exif } : {}),
  };
}
