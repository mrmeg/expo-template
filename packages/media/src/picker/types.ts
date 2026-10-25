/**
 * Picker contracts, kept free of `expo-image-picker` imports.
 *
 * `/upload-queue` consumes `PickedMediaAsset`, and it must stay installable and
 * type-checkable without the picker peer, so the shared shapes live here rather
 * than beside the code that calls the native module.
 */

import type { ProcessAssetInput } from "../processing/processAsset";

/** Capture facts read from the picker's EXIF block. Every key is optional. */
export interface PickedMediaExif {
  /** When the photo was taken, from `DateTimeOriginal` and friends. */
  takenAt?: Date;
  /** Decimal degrees, south negative. */
  lat?: number;
  /** Decimal degrees, west negative. */
  lng?: number;
}

/**
 * One picked file: exactly what `processAsset` takes, plus a stable `id` and the
 * EXIF facts that re-encoding is about to strip from the bytes.
 */
export interface PickedMediaAsset extends ProcessAssetInput {
  /** Unique within the app session. Safe to use as a React key. */
  id: string;
  exif?: PickedMediaExif;
}

export type MediaPickerSource = "library" | "camera";

export type MediaPickerMediaType = "images" | "videos";

export interface PickMediaOptions {
  /** Where the media comes from. Defaults to `"library"`. */
  source?: MediaPickerSource;
  /** Defaults to `["images"]`. */
  mediaTypes?: MediaPickerMediaType[];
  /** Library only; the camera takes one capture. Defaults to `false`. */
  multiple?: boolean;
  /** With `multiple`: the most files the picker accepts. `0` or unset is unlimited. */
  selectionLimit?: number;
  allowsEditing?: boolean;
}

/**
 * How a pick ends. Cancelling is a normal outcome, not an error; a refused
 * permission is a result too, so the UI can offer Settings instead of a toast
 * the package would otherwise have to own.
 */
export type PickMediaResult =
  | { status: "picked"; assets: PickedMediaAsset[] }
  | { status: "canceled" }
  | {
      status: "denied";
      /** False once the OS will no longer show its prompt: send the user to Settings. */
      canAskAgain: boolean;
    };
