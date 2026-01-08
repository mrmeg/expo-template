import { useState } from "react";
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { Alert } from "@/client/components/ui/Alert";
import { logDev } from "@/client/devtools";
import { extractVideoThumbnail } from "@/client/hooks/useVideoThumbnails";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { useCompressionStore } from "@/client/stores/compressionStore";
import {
  compressImage,
  convertHeicToJpeg,
  type CompressionConfig,
  type ImagePreset,
} from "@/client/lib/imageCompression";

/**
 * Get image dimensions from a blob by loading it as an HTMLImageElement.
 * Needed for HEIC images where picker returns 0x0 dimensions.
 */
async function getImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for dimensions"));
    };
    img.src = url;
  });
}

interface ProcessedAsset
  extends Omit<ImagePicker.ImagePickerAsset, "base64" | "exif" | "cancelled"> {
  id: string;
  blob?: Blob;
  // Video-specific fields
  duration?: number; // Duration in seconds
  thumbnailUri?: string; // Local thumbnail URI
  thumbnailBlob?: Blob; // Thumbnail blob for web upload
  // EXIF-derived metadata
  exifTakenAt?: Date; // Date photo was taken (from EXIF DateTimeOriginal)
  exifLat?: number; // GPS latitude (from EXIF GPSLatitude)
  exifLng?: number; // GPS longitude (from EXIF GPSLongitude)
  // Compression info
  originalSize?: number; // Original file size before compression
  compressionApplied?: boolean; // Whether compression was applied
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

interface PickMediaOptions {
  allowsMultipleSelection?: boolean;
  allowsEditing?: boolean;
  selectionLimit?: number;
  mediaTypes?: ("images" | "videos")[];
  /**
   * Compression options for images.
   * - Preset name: 'avatar', 'thumbnail', 'product', 'gallery', 'highQuality', 'none'
   * - Custom config: { maxDimension, quality, maxSizeKB, minQuality, format }
   * - undefined: Uses store default (typically 'gallery')
   * - null or 'none': Skip compression
   */
  compression?: ImagePreset | Partial<CompressionConfig> | null;
}

export function useMediaLibrary() {
  const [permissionResponse, requestPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [selectedAssets, setSelectedAssets] = useState<ProcessedAsset[]>([]);
  const [processing, setProcessing] = useState(false);
  const getCompressionConfig = useCompressionStore((state) => state.getConfig);

  const processAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    compressionConfig: CompressionConfig | null
  ): Promise<ProcessedAsset> => {
    const id = Crypto.randomUUID();
    const isVideo =
      asset.type === "video" || asset.mimeType?.startsWith("video/") || false;

    // Extract EXIF metadata (GPS, date taken)
    const exif = (asset as any).exif as Record<string, any> | undefined;
    const gps = parseExifGps(exif);
    const takenAt = parseExifDate(exif);

    if (gps) {
      logDev(`EXIF GPS: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`);
    }
    if (takenAt) {
      logDev(`EXIF Date: ${takenAt.toISOString()}`);
    }

    // Extract thumbnail and duration for videos
    let thumbnailUri: string | undefined;
    let thumbnailBlob: Blob | undefined;
    let duration: number | undefined;

    if (isVideo) {
      // Duration comes from ImagePicker (in milliseconds on some platforms, seconds on others)
      // expo-image-picker returns duration in seconds
      duration = asset.duration ? Math.round(asset.duration) : undefined;

      // Extract thumbnail at 1 second mark
      try {
        const thumbnail = await extractVideoThumbnail(asset.uri, 1000);
        if (thumbnail) {
          thumbnailUri = thumbnail.uri;
          thumbnailBlob = thumbnail.blob;
          logDev(
            `Video thumbnail extracted: ${thumbnail.width}x${thumbnail.height}`
          );
        }
      } catch (error) {
        logDev(`Failed to extract video thumbnail: ${error}`);
      }
    }

    if (Platform.OS === "web") {
      return processAssetWeb(
        asset,
        id,
        isVideo,
        compressionConfig,
        { gps, takenAt },
        { thumbnailUri, thumbnailBlob, duration }
      );
    } else {
      return processAssetNative(
        asset,
        id,
        isVideo,
        compressionConfig,
        { gps, takenAt },
        { thumbnailUri, thumbnailBlob, duration }
      );
    }
  };

  const processAssetWeb = async (
    asset: ImagePicker.ImagePickerAsset,
    id: string,
    isVideo: boolean,
    compressionConfig: CompressionConfig | null,
    metadata: {
      gps: { lat: number; lng: number } | null;
      takenAt: Date | null;
    },
    videoData: {
      thumbnailUri?: string;
      thumbnailBlob?: Blob;
      duration?: number;
    }
  ): Promise<ProcessedAsset> => {
    try {
      const response = await fetch(asset.uri);
      let blob = await response.blob();
      const originalSize = blob.size;

      // Convert HEIC to JPEG if needed (for browser compatibility) - only for images
      if (!isVideo) {
        blob = await convertHeicToJpeg(blob, asset.fileName || undefined);
      }

      // Get actual dimensions - needed for HEIC where picker returns 0x0
      let imageWidth = asset.width;
      let imageHeight = asset.height;
      if (!isVideo && (imageWidth === 0 || imageHeight === 0)) {
        try {
          const dims = await getImageDimensions(blob);
          imageWidth = dims.width;
          imageHeight = dims.height;
          logDev(`Got image dimensions from blob: ${imageWidth}x${imageHeight}`);
        } catch {
          logDev("Failed to get image dimensions from blob");
        }
      }

      // Apply compression for images (not videos)
      let finalUri = asset.uri;
      let finalBlob = blob;
      let finalWidth = imageWidth;
      let finalHeight = imageHeight;
      let finalMimeType = blob.type;
      let compressionApplied = false;

      if (!isVideo && compressionConfig && imageWidth > 0 && imageHeight > 0) {
        globalUIStore.getState().show({
          type: "info",
          title: "Compressing",
          messages: ["Optimizing image..."],
          loading: true,
        });

        try {
          const blobUri = URL.createObjectURL(blob);
          const compressed = await compressImage({
            uri: blobUri,
            width: imageWidth,
            height: imageHeight,
            config: compressionConfig,
            originalSize: blob.size,
          });

          // Clean up temporary blob URL
          URL.revokeObjectURL(blobUri);

          finalUri = compressed.uri;
          finalBlob = compressed.blob!;
          finalWidth = compressed.width;
          finalHeight = compressed.height;
          finalMimeType = compressed.mimeType;
          compressionApplied = true;

          const reduction = (
            ((originalSize - compressed.size) / originalSize) *
            100
          ).toFixed(0);
          logDev(
            `Compression: ${(originalSize / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${reduction}% reduction)`
          );

          globalUIStore.getState().hide();
        } catch (error) {
          globalUIStore.getState().show({
            type: "error",
            title: "Compression Failed",
            messages: ["Using original image"],
            duration: 3000,
          });
          logDev(`Compression failed, using original: ${error}`);
          finalUri = URL.createObjectURL(blob);
        }
      } else {
        finalUri = URL.createObjectURL(blob);
      }

      const mediaType = isVideo ? "video" : "image";
      logDev(
        `Processed ${mediaType}: ${(finalBlob.size / 1024 / 1024).toFixed(2)}MB (${finalWidth}x${finalHeight})${videoData.duration ? ` ${videoData.duration}s` : ""}`
      );

      return {
        id,
        fileName: asset.fileName || `file-${id}`,
        fileSize: finalBlob.size,
        type:
          asset.type ||
          (finalBlob.type.split("/")[0] as ImagePicker.ImagePickerAsset["type"]),
        mimeType: finalMimeType,
        width: finalWidth,
        height: finalHeight,
        blob: finalBlob,
        uri: finalUri,
        duration: videoData.duration,
        thumbnailUri: videoData.thumbnailUri,
        thumbnailBlob: videoData.thumbnailBlob,
        // EXIF-derived metadata
        exifTakenAt: metadata.takenAt || undefined,
        exifLat: metadata.gps?.lat,
        exifLng: metadata.gps?.lng,
        // Compression info
        originalSize,
        compressionApplied,
      };
    } catch (error) {
      console.error("Error processing asset:", error);
      throw error;
    }
  };

  const processAssetNative = async (
    asset: ImagePicker.ImagePickerAsset,
    id: string,
    isVideo: boolean,
    compressionConfig: CompressionConfig | null,
    metadata: {
      gps: { lat: number; lng: number } | null;
      takenAt: Date | null;
    },
    videoData: {
      thumbnailUri?: string;
      thumbnailBlob?: Blob;
      duration?: number;
    }
  ): Promise<ProcessedAsset> => {
    const originalSize = asset.fileSize || 0;
    let finalUri = asset.uri;
    let finalWidth = asset.width;
    let finalHeight = asset.height;
    let finalSize = originalSize;
    let finalMimeType = asset.mimeType || "application/octet-stream";
    let compressionApplied = false;

    // Apply compression for images (not videos)
    if (!isVideo && compressionConfig) {
      globalUIStore.getState().show({
        type: "info",
        title: "Compressing",
        messages: ["Optimizing image..."],
        loading: true,
      });

      try {
        const compressed = await compressImage({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          config: compressionConfig,
          originalSize,
        });

        finalUri = compressed.uri;
        finalWidth = compressed.width;
        finalHeight = compressed.height;
        finalSize = compressed.size;
        finalMimeType = compressed.mimeType;
        compressionApplied = true;

        const reduction = (
          ((originalSize - compressed.size) / originalSize) *
          100
        ).toFixed(0);
        logDev(
          `Compression: ${(originalSize / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${reduction}% reduction)`
        );

        globalUIStore.getState().hide();
      } catch (error) {
        globalUIStore.getState().show({
          type: "error",
          title: "Compression Failed",
          messages: ["Using original image"],
          duration: 3000,
        });
        logDev(`Compression failed, using original: ${error}`);
      }
    }

    const mediaType = isVideo ? "video" : "image";
    logDev(
      `${mediaType} picked (native): ${(finalSize / 1024 / 1024).toFixed(2)}MB (${finalWidth}x${finalHeight})${videoData.duration ? ` ${videoData.duration}s` : ""}`
    );

    return {
      id,
      fileName: asset.fileName || `file-${id}`,
      fileSize: finalSize,
      type: asset.type || undefined,
      mimeType: finalMimeType,
      width: finalWidth,
      height: finalHeight,
      uri: finalUri,
      // No blob on native - useMediaUpload handles URI-based uploads
      duration: videoData.duration,
      thumbnailUri: videoData.thumbnailUri,
      thumbnailBlob: videoData.thumbnailBlob,
      // EXIF-derived metadata
      exifTakenAt: metadata.takenAt || undefined,
      exifLat: metadata.gps?.lat,
      exifLng: metadata.gps?.lng,
      // Compression info
      originalSize,
      compressionApplied,
    };
  };

  const pickMedia = async ({
    allowsMultipleSelection = false,
    allowsEditing = false,
    selectionLimit = 20,
    mediaTypes = ["images"],
    compression,
  }: PickMediaOptions = {}) => {
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

      // Resolve compression config from options or store defaults
      const compressionConfig = getCompressionConfig(compression);

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
        result &&
        !result.canceled &&
        result.assets &&
        result.assets.length > 0
      ) {
        const processedAssets = await Promise.all(
          result.assets.map((asset) => processAsset(asset, compressionConfig))
        );

        // Log final file sizes
        processedAssets.forEach((asset, index) => {
          const sizeInMB = ((asset.fileSize || 0) / 1024 / 1024).toFixed(2);
          logDev(
            `Asset ${index + 1}: ${asset.fileName} - ${sizeInMB}MB (${asset.width}x${asset.height})`
          );
        });

        setSelectedAssets(
          allowsMultipleSelection ? processedAssets : [processedAssets[0]]
        );
        return processedAssets;
      }
      return null;
    } catch (error) {
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
