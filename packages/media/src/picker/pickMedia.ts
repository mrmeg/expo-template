import { useCallback, useEffect, useRef, useState } from "react";
import {
  PermissionStatus,
  getCameraPermissionsAsync,
  getMediaLibraryPermissionsAsync,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  type ImagePickerOptions,
  type PermissionResponse,
} from "expo-image-picker";
import { toPickedMediaAsset } from "./toPickedMediaAsset";
import type { MediaPickerSource, PickMediaOptions, PickMediaResult } from "./types";

/**
 * Ask the OS for access unless it is already granted or can no longer be asked.
 * The decision reads the *response*, never React state, so a denial that just
 * happened stops the pick instead of falling through to the launcher.
 */
async function ensurePermission(source: MediaPickerSource): Promise<PermissionResponse> {
  const get = source === "camera" ? getCameraPermissionsAsync : getMediaLibraryPermissionsAsync;
  const request =
    source === "camera" ? requestCameraPermissionsAsync : requestMediaLibraryPermissionsAsync;

  const current = await get();
  if (current.granted) return current;
  if (current.status === PermissionStatus.UNDETERMINED || current.canAskAgain) {
    return request();
  }
  return current;
}

/** Everything `launch*Async` receives, with the defaults the pipeline relies on. */
function launchOptions(options: PickMediaOptions): ImagePickerOptions {
  const library = (options.source ?? "library") === "library";
  const multiple = library && options.multiple === true;

  return {
    base64: false,
    // EXIF is read for capture time and location; re-encoding strips it later.
    exif: true,
    mediaTypes: options.mediaTypes ?? ["images"],
    allowsEditing: options.allowsEditing ?? false,
    // Full quality from the picker: the compression ladder encodes once, later.
    quality: 1,
    ...(library
      ? {
        allowsMultipleSelection: multiple,
        selectionLimit: multiple ? options.selectionLimit : 1,
        orderedSelection: true,
      }
      : {}),
  };
}

/**
 * Pick media from the library or the camera.
 *
 * Resolves, never throws, for the three ordinary outcomes: `picked`, `canceled`,
 * and `denied`. A native module failure still rejects. The assets come back
 * unprocessed; hand them to `useUploadQueue().add` or to `processAsset`.
 */
export async function pickMedia(options: PickMediaOptions = {}): Promise<PickMediaResult> {
  return runPick(options);
}

async function runPick(
  options: PickMediaOptions,
  onPermission?: (permission: PermissionResponse) => void,
): Promise<PickMediaResult> {
  const source = options.source ?? "library";

  const permission = await ensurePermission(source);
  onPermission?.(permission);
  if (!permission.granted) {
    return { status: "denied", canAskAgain: permission.canAskAgain };
  }

  const launch = source === "camera" ? launchCameraAsync : launchImageLibraryAsync;
  const result = await launch(launchOptions(options));

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { status: "canceled" };
  }

  const assets = await Promise.all(result.assets.map(toPickedMediaAsset));
  return { status: "picked", assets };
}

export interface UseMediaPickerResult {
  /** See `pickMedia`. */
  pick: (options?: PickMediaOptions) => Promise<PickMediaResult>;
  /** True from the call to `pick` until its result is ready, including the permission prompt. */
  picking: boolean;
  /**
   * The OS response from the latest `pick`, or `null` before the first one.
   * Reflects the source that pick used (library or camera).
   */
  permission: PermissionResponse | null;
}

/**
 * `pickMedia` with the state a screen binds to. Unmount-safe: a pick that
 * resolves after the screen is gone still resolves for its caller, and updates
 * nothing.
 */
export function useMediaPicker(): UseMediaPickerResult {
  const [picking, setPicking] = useState(false);
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pick = useCallback(async (options: PickMediaOptions = {}) => {
    inFlight.current += 1;
    setPicking(true);
    try {
      return await runPick(options, (response) => {
        if (mounted.current) setPermission(response);
      });
    } finally {
      inFlight.current -= 1;
      if (mounted.current && inFlight.current === 0) setPicking(false);
    }
  }, []);

  return { pick, picking, permission };
}
