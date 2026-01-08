/**
 * Image compression utilities.
 * Web: Uses Canvas API
 * Native: TODO - expo-image-manipulator has bundling issues with Expo Router
 */

import { Platform } from "react-native";
import type { CompressionConfig } from "@/shared/imageCompression";
import { logDev } from "@/client/devtools";

export interface CompressedImage {
  uri: string;
  blob?: Blob;
  width: number;
  height: number;
  mimeType: string;
  size: number;
}

interface CompressImageOptions {
  uri: string;
  width: number;
  height: number;
  config: CompressionConfig;
  originalSize?: number;
}

/**
 * Calculate target dimensions maintaining aspect ratio.
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number | null
): { targetWidth: number; targetHeight: number } {
  if (!maxDimension || (width <= maxDimension && height <= maxDimension)) {
    return { targetWidth: width, targetHeight: height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      targetWidth: maxDimension,
      targetHeight: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      targetWidth: Math.round(maxDimension * aspectRatio),
      targetHeight: maxDimension,
    };
  }
}

/**
 * Compress an image.
 * Web: Uses Canvas API
 * Native: Returns original (TODO: fix expo-image-manipulator bundling)
 */
export async function compressImage(
  options: CompressImageOptions
): Promise<CompressedImage> {
  const { uri, width, height, config } = options;

  const { targetWidth, targetHeight } = calculateDimensions(
    width,
    height,
    config.maxDimension
  );

  const format = config.format || "jpeg";

  logDev(
    `Compressing image: ${width}x${height} → ${targetWidth}x${targetHeight}, quality: ${config.quality}, format: ${format}`
  );

  if (Platform.OS === "web") {
    return compressImageWeb(uri, targetWidth, targetHeight, config);
  } else {
    // Native compression not yet available due to bundling issues
    logDev("Native compression not available - returning original");
    return {
      uri,
      width,
      height,
      mimeType: "image/jpeg",
      size: 0,
    };
  }
}

// ============================================================================
// Web Implementation (Canvas API)
// ============================================================================

async function compressImageWeb(
  uri: string,
  targetWidth: number,
  targetHeight: number,
  config: CompressionConfig
): Promise<CompressedImage> {
  // Load image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = uri;
  });

  // Create canvas and draw resized image
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const mimeType =
    config.format === "webp"
      ? "image/webp"
      : config.format === "png"
        ? "image/png"
        : "image/jpeg";

  let quality = config.quality;
  let blob = await canvasToBlob(canvas, mimeType, quality);
  const maxSizeBytes = config.maxSizeKB ? config.maxSizeKB * 1024 : null;

  // Progressive quality reduction to hit target size
  while (
    maxSizeBytes &&
    blob.size > maxSizeBytes &&
    quality > config.minQuality
  ) {
    quality = Math.round((quality - 0.05) * 100) / 100;
    logDev(
      `Image still ${(blob.size / 1024).toFixed(0)}KB > ${config.maxSizeKB}KB, reducing quality to ${quality}`
    );
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  const resultUri = URL.createObjectURL(blob);

  logDev(
    `Compression complete: ${(blob.size / 1024).toFixed(0)}KB, quality: ${quality}`
  );

  return {
    uri: resultUri,
    blob,
    width: targetWidth,
    height: targetHeight,
    mimeType,
    size: blob.size,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob from canvas"));
      },
      mimeType,
      quality
    );
  });
}

// ============================================================================
// HEIC Conversion (Web only)
// ============================================================================

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
      `HEIC conversion complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB → ${(convertedBlob.size / 1024 / 1024).toFixed(2)}MB`
    );

    return convertedBlob;
  } catch (error) {
    logDev(`HEIC conversion failed, using original: ${error}`);
    return blob;
  }
}
