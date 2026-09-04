import { useState } from "react";
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { Alert } from "@mrmeg/expo-ui/components/Alert";
import { logDev } from "@/client/lib/devtools";
import {
  isMediaProcessingError,
  mapWithConcurrency,
  processAsset,
  type ProcessAssetInput,
  type ProcessedUpload,
  type ProcessingPhase,
} from "@mrmeg/expo-media/processing";
import type {
  CompressionConfig,
  ImagePreset,
} from "@mrmeg/expo-media/processing/image-compression/config";
import { notify } from "@mrmeg/expo-ui/state";
import { MEDIA_CONTENT_TYPE_ALLOWLIST, type MediaType } from "@/shared/media";
import { useCompressionStore } from "../stores/compressionStore";
import {
  MEDIA_APP_SETTINGS,
  resolveMediaUploadPolicy,
  type MediaUploadFilter,
} from "../mediaSettings";

/**
 * A picked asset, processed and ready to upload.
 *
 * `mimeType` is guaranteed to be a content type the server accepts — the
 * pipeline either produced one or rejected the asset, so there is no
 * `application/octet-stream` case to handle here.
 */
interface ProcessedAsset {
  id: string;
  uri: string;
  blob?: Blob;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  type: "image" | "video";
  /** Which upload policy (and therefore which storage prefix) this asset uses. */
  mediaType: MediaType;
  // Video-specific fields
  duration?: number;
  thumbnailUri?: string;
  thumbnailBlob?: Blob;
  // EXIF-derived metadata, forwarded as upload metadata because re-encoding
  // deliberately strips EXIF from the bytes.
  exifTakenAt?: Date;
  exifLat?: number;
  exifLng?: number;
  // Processing info
  originalSize: number;
  compressionApplied: boolean;
  /** Ordered trace of what the pipeline did. Useful in dev logs. */
  applied: readonly string[];
}

/**
 * Parse GPS coordinates from EXIF data
 * EXIF stores GPS as degrees/minutes/seconds arrays with N/S/E/W references
 */
function parseExifGps(
  exif: Record<string, any> | undefined
): { lat: number; lng: number } | null {
  if (!exif) return null;

  // Try different EXIF structures (varies by platform/library)
  const gps = exif.GPSInfo || exif;
  const lat = gps.GPSLatitude;
  const lng = gps.GPSLongitude;
  const latRef = gps.GPSLatitudeRef;
  const lngRef = gps.GPSLongitudeRef;

  if (!lat || !lng) return null;

  // Convert DMS (degrees, minutes, seconds) to decimal
  const toDecimal = (dms: number[], ref: string): number => {
    if (!Array.isArray(dms) || dms.length < 3) return 0;
    const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return ref === "S" || ref === "W" ? -decimal : decimal;
  };

  return {
    lat: toDecimal(lat, latRef || "N"),
    lng: toDecimal(lng, lngRef || "E"),
  };
}

/**
 * Parse date taken from EXIF data
 * EXIF format: "YYYY:MM:DD HH:MM:SS"
 */
function parseExifDate(exif: Record<string, any> | undefined): Date | null {
  if (!exif) return null;

  const dateStr =
    exif.DateTimeOriginal || exif.DateTime || exif.DateTimeDigitized;
  if (!dateStr || typeof dateStr !== "string") return null;

  try {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const parts = dateStr.split(" ");
    if (parts.length !== 2) return null;

    const [datePart, timePart] = parts;
    const isoDate = `${datePart.replace(/:/g, "-")}T${timePart}`;
    const date = new Date(isoDate);

    // Validate the date is reasonable
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() < 1990 || date.getFullYear() > 2100) return null;

    return date;
  } catch {
    return null;
  }
}

/** EXIF orientations 5-8 transpose the stored dimensions. */
function parseExifOrientation(exif: Record<string, any> | undefined): number | null {
  const value = exif?.Orientation;
  return typeof value === "number" ? value : null;
}

interface PickMediaOptions {
  allowsMultipleSelection?: boolean;
  allowsEditing?: boolean;
  selectionLimit?: number;
  mediaTypes?: ("images" | "videos")[];
  /**
   * Which upload policy set applies. Resolved *per asset*, so a mixed
   * image/video selection compresses images and leaves videos alone, and an
   * avatar pick gets the avatar preset.
   */
  filter?: MediaUploadFilter;
  /**
   * Explicit compression override, applied to every image in the selection.
   * Leave unset to use the per-asset policy from `MEDIA_APP_SETTINGS`.
   * - Preset name: 'avatar', 'thumbnail', 'product', 'gallery', 'highQuality', 'none'
   * - Custom config: { rungs, quality, byteBudget, passthroughBytes, format }
   * - null or 'none': Skip the ladder (the pipeline still transcodes when the
   *   source content type is not uploadable, e.g. HEIC)
   */
  compression?: ImagePreset | Partial<CompressionConfig> | null;
}

interface ProcessingContext {
  index: number;
  total: number;
  fileName: string;
  suppressCompressionNotification: boolean;
}

function isVideoAsset(asset: ImagePicker.ImagePickerAsset) {
  return (
    asset.type === "video" || asset.mimeType?.startsWith("video/") || false
  );
}

function getProcessingTitle(action: string, context: ProcessingContext) {
  return context.total > 1
    ? `${action} ${context.index} of ${context.total}`
    : action;
}

/**
 * Translate pipeline phases into this app's toasts.
 *
 * The package orchestrator is UI-free on purpose: the toast vocabulary belongs
 * to the app, not to a publishable library.
 */
function notifyPhase(phase: ProcessingPhase, context: ProcessingContext) {
  if (context.suppressCompressionNotification) return;

  switch (phase.type) {
  case "decoding-heic":
    notify.loading(getProcessingTitle("Reading Photo", context), {
      messages: [`Decoding ${context.fileName}...`],
    });
    return;
  case "compressing":
    notify.loading(getProcessingTitle("Optimizing Image", context), {
      messages: [`Optimizing ${context.fileName}...`],
    });
    return;
  case "converting-video":
    notify.loading(getProcessingTitle("Converting Video", context), {
      messages: [
        phase.progress !== undefined
          ? `Converting ${context.fileName} to MP4... ${phase.progress}%`
          : `Loading converter for ${context.fileName}...`,
      ],
    });
    return;
  default:
    return;
  }
}

/** The web pipeline works on bytes, and the upload needs the same Blob. */
async function readAssetBlob(uri: string): Promise<Blob | undefined> {
  if (Platform.OS !== "web") return undefined;
  try {
    const response = await fetch(uri);
    return await response.blob();
  } catch (error) {
    logDev(`Could not read picked file bytes: ${error}`);
    return undefined;
  }
}

function toProcessedAsset(
  upload: ProcessedUpload,
  input: {
    id: string;
    fileName: string;
    mediaType: MediaType;
    exif: { gps: { lat: number; lng: number } | null; takenAt: Date | null };
  },
): ProcessedAsset {
  return {
    id: input.id,
    uri: upload.uri,
    blob: upload.blob,
    fileName: input.fileName,
    fileSize: upload.size,
    mimeType: upload.contentType,
    width: upload.width,
    height: upload.height,
    type: upload.kind,
    mediaType: input.mediaType,
    duration: upload.durationSeconds,
    thumbnailUri: upload.thumbnail?.uri,
    thumbnailBlob: upload.thumbnail?.blob,
    exifTakenAt: input.exif.takenAt || undefined,
    exifLat: input.exif.gps?.lat,
    exifLng: input.exif.gps?.lng,
    originalSize: upload.originalSize,
    compressionApplied: upload.applied.some((step) => step.startsWith("resize:")),
    applied: upload.applied,
  };
}

export function useMediaLibrary() {
  const [permissionResponse, requestPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [selectedAssets, setSelectedAssets] = useState<ProcessedAsset[]>([]);
  const [processing, setProcessing] = useState(false);
  const getCompressionConfig = useCompressionStore((state) => state.getConfig);

  const pickMedia = async ({
    allowsMultipleSelection = false,
    allowsEditing = false,
    selectionLimit = MEDIA_APP_SETTINGS.uploads.selectionLimit,
    mediaTypes = ["images"],
    filter = "all",
    compression,
  }: PickMediaOptions = {}) => {
    let batchCompressionNotificationVisible = false;
    setProcessing(true);
    try {
      if (!permissionResponse || permissionResponse.status === "undetermined") {
        await requestPermission();
      }

      if (permissionResponse && permissionResponse.status === "denied") {
        Alert.show({
          message:
            "You have denied media library access. You will need to allow access in your phone's Settings app to upload media.",
        });
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        base64: false,
        exif: true, // Extract EXIF metadata (GPS, date, etc.)
        mediaTypes: mediaTypes,
        allowsMultipleSelection: allowsMultipleSelection,
        selectionLimit: allowsMultipleSelection ? selectionLimit : 1,
        allowsEditing: allowsEditing,
        quality: 1, // Full quality from picker - we compress separately
        orderedSelection: true,
      });

      if (
        !result ||
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      ) {
        return null;
      }

      const totalAssets = result.assets.length;
      const imageAssetCount = result.assets.filter(
        (asset) => !isVideoAsset(asset)
      ).length;
      const useBatchCompressionNotification = imageAssetCount > 1;

      if (useBatchCompressionNotification) {
        batchCompressionNotificationVisible = true;
        notify.loading("Optimizing Images", {
          messages: [`Optimizing ${imageAssetCount} images...`],
        });
      }

      // Bounded concurrency: each in-flight asset holds a full-resolution
      // bitmap, so a 20-photo selection through Promise.all janks the web tab
      // and gets the native app killed.
      const outcomes = await mapWithConcurrency(
        result.assets,
        MEDIA_APP_SETTINGS.processing.concurrency,
        async (asset, index) => {
          const fileName = asset.fileName || `file-${index + 1}`;
          const context: ProcessingContext = {
            index: index + 1,
            total: totalAssets,
            fileName,
            suppressCompressionNotification: useBatchCompressionNotification,
          };

          // The upload policy is resolved per asset and *before* processing, so
          // an avatar is compressed with the avatar preset instead of the
          // screen's default.
          const uploadPolicy = resolveMediaUploadPolicy(asset, filter);
          const config = getCompressionConfig(
            compression !== undefined ? compression : uploadPolicy.policy.compression,
          );

          const exif = (asset as { exif?: Record<string, any> }).exif;
          const gps = parseExifGps(exif);
          const takenAt = parseExifDate(exif);

          const input: ProcessAssetInput = {
            uri: asset.uri,
            blob: await readAssetBlob(asset.uri),
            contentType: asset.mimeType,
            fileName: asset.fileName,
            width: asset.width,
            height: asset.height,
            size: asset.fileSize,
            kind: isVideoAsset(asset) ? "video" : "image",
            durationSeconds: asset.duration
              ? Math.round(asset.duration)
              : undefined,
            exifOrientation: parseExifOrientation(exif),
          };

          try {
            const upload = await processAsset({
              asset: input,
              allowlist: MEDIA_CONTENT_TYPE_ALLOWLIST,
              config,
              onPhase: (_asset, phase) => notifyPhase(phase, context),
            });

            return {
              ok: true as const,
              asset: toProcessedAsset(upload, {
                id: Crypto.randomUUID(),
                fileName,
                mediaType: uploadPolicy.policy.mediaType,
                exif: { gps, takenAt },
              }),
            };
          } catch (error) {
            const reason = isMediaProcessingError(error)
              ? error.message
              : "This file could not be processed.";
            logDev(`Processing failed for ${fileName}: ${error}`);
            return { ok: false as const, fileName, reason };
          }
        },
      );

      if (batchCompressionNotificationVisible) {
        notify.hide();
        batchCompressionNotificationVisible = false;
      }

      const processedAssets = outcomes.flatMap((outcome) =>
        outcome.ok ? [outcome.asset] : []
      );
      const failures = outcomes.flatMap((outcome) =>
        outcome.ok ? [] : [outcome]
      );

      if (failures.length > 0) {
        notify.error(
          failures.length === 1 ? "File Skipped" : `${failures.length} Files Skipped`,
          {
            messages: failures
              .slice(0, 3)
              .map((failure) => `${failure.fileName}: ${failure.reason}`),
            duration: 6000,
          }
        );
      }

      processedAssets.forEach((asset, index) => {
        logDev(
          `Asset ${index + 1}: ${asset.fileName} - ${(asset.fileSize / 1024 / 1024).toFixed(2)}MB ${asset.mimeType} (${asset.width}x${asset.height}) [${asset.applied.join(", ")}]`
        );
      });

      if (processedAssets.length === 0) return null;

      setSelectedAssets(
        allowsMultipleSelection ? processedAssets : [processedAssets[0]]
      );
      return processedAssets;
    } catch (error) {
      if (batchCompressionNotificationVisible) {
        notify.hide();
      }
      console.error("Error in pickMedia:", error);
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const clearAssets = () => {
    if (Platform.OS === "web") {
      selectedAssets.forEach((asset) => {
        if (asset.uri.startsWith("blob:")) {
          URL.revokeObjectURL(asset.uri);
        }
        // Also revoke thumbnail blob URLs
        if (asset.thumbnailUri?.startsWith("blob:")) {
          URL.revokeObjectURL(asset.thumbnailUri);
        }
      });
    }
    setSelectedAssets([]);
  };

  return { assets: selectedAssets, pickMedia, processing, clearAssets };
}

export type { ProcessedAsset, PickMediaOptions };
