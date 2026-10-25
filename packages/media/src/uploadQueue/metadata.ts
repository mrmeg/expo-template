import type { PickedMediaExif } from "../picker/types";

/**
 * The default upload metadata: capture time and location as strings, only the
 * keys that exist, `undefined` when there are none. Re-encoding strips EXIF from
 * the bytes by design, so this is how the facts reach `policy.canUpload` and
 * `events.onUploadSigned` on the server.
 */
export function buildExifUploadMetadata(
  exif: PickedMediaExif | undefined,
): Record<string, string> | undefined {
  if (!exif) return undefined;

  const metadata: Record<string, string> = {};
  if (exif.takenAt) metadata.takenAt = exif.takenAt.toISOString();
  if (exif.lat !== undefined) metadata.lat = String(exif.lat);
  if (exif.lng !== undefined) metadata.lng = String(exif.lng);

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
