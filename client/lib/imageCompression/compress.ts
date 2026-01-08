/**
 * Web image compression implementation using Canvas API.
 * This file is used on web platform only.
 */

import { logDev } from "@/client/devtools";
import type { CompressionConfig } from "./config";
import type { CompressedImage, CompressImageOptions } from "./types";
import {
  calculateDimensions,
  getMimeType,
  reduceQuality,
  shouldContinueCompression,
  formatFileSize,
} from "./utils";

/**
 * Load an image from URI into an HTMLImageElement.
 */
async function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = uri;
  });
}

/**
 * Convert canvas to Blob with specified format and quality.
 */
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

/**
 * Compress an image using the Canvas API.
 *
 * Features:
 * - Resize to max dimension while maintaining aspect ratio
 * - Adjustable quality for JPEG/WebP
 * - Progressive quality reduction to hit target file size
 * - Returns both URI (blob URL) and Blob for upload flexibility
 *
 * @param options - Compression options including URI, dimensions, and config
 * @returns Promise resolving to CompressedImage with blob URL and metadata
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
    `[Web] Compressing image: ${width}x${height} -> ${targetWidth}x${targetHeight}, quality: ${config.quality}, format: ${format}`
  );

  // Load image
  const img = await loadImage(uri);

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

  const mimeType = getMimeType(config.format);

  let quality = config.quality;
  let blob = await canvasToBlob(canvas, mimeType, quality);

  // Progressive quality reduction to hit target size
  while (
    shouldContinueCompression(
      blob.size,
      config.maxSizeKB,
      quality,
      config.minQuality
    )
  ) {
    quality = reduceQuality(quality);
    logDev(
      `Image still ${formatFileSize(blob.size)} > ${config.maxSizeKB}KB, reducing quality to ${quality}`
    );
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  const resultUri = URL.createObjectURL(blob);

  logDev(`Compression complete: ${formatFileSize(blob.size)}, quality: ${quality}`);

  return {
    uri: resultUri,
    blob,
    width: targetWidth,
    height: targetHeight,
    mimeType,
    size: blob.size,
  };
}
