/**
 * Headless media picking.
 *
 * Wraps `expo-image-picker` (an optional peer; only this subpath imports it) and
 * returns `PickedMediaAsset`s ready for `/upload-queue` or `processAsset`. No
 * alerts and no toasts: permission refusal is a result, and the app decides how
 * to tell the user.
 */

export { pickMedia, useMediaPicker, type UseMediaPickerResult } from "./pickMedia";
export { toPickedMediaAsset } from "./toPickedMediaAsset";
export { parseExifDate, parseExifGps, parseExifOrientation } from "./exif";
export type {
  MediaPickerMediaType,
  MediaPickerSource,
  PickMediaOptions,
  PickMediaResult,
  PickedMediaAsset,
  PickedMediaExif,
} from "./types";
