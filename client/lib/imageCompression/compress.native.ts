/**
 * Native image compression implementation using expo-image-manipulator.
 * This file is used on iOS and Android platforms only.
 */

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
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
 * Map compression format config to expo-image-manipulator SaveFormat.
 */
function getSaveFormat(format: CompressionConfig["format"]): SaveFormat {
  switch (format) {
    case "png":
      return SaveFormat.PNG;
    case "webp":
      return SaveFormat.WEBP;
    case "jpeg":
    default:
      return SaveFormat.JPEG;
  }
}

/**
 * Get file size from a URI using expo-file-system.
 * Returns 0 if the file doesn't exist or can't be read.
 */
function getFileSize(uri: string): number {
  try {
    const file = new File(uri);
    return file.size;
  } catch {
    return 0;
  }
}

/**
 * Compress an image using expo-image-manipulator.
 *
 * Features:
 * - Resize to max dimension while maintaining aspect ratio
 * - Adjustable quality for JPEG/WebP
 * - Progressive quality reduction to hit target file size
 * - Native HEIC support (no conversion needed)
 * - Returns file URI for use with expo-file-system or fetch
 *
 * @param options - Compression options including URI, dimensions, and config
 * @returns Promise resolving to CompressedImage with file URI and metadata
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
  const saveFormat = getSaveFormat(config.format);

  logDev(
    `[Native] Compressing image: ${width}x${height} -> ${targetWidth}x${targetHeight}, quality: ${config.quality}, format: ${format}`
  );

  let quality = config.quality;

  // Perform initial compression
  let result = await compressWithQuality(
    uri,
    targetWidth,
    targetHeight,
    width,
    height,
    saveFormat,
    quality
  );

  let fileSize = getFileSize(result.uri);

  // Progressive quality reduction to hit target size
  while (
    shouldContinueCompression(
      fileSize,
      config.maxSizeKB,
      quality,
      config.minQuality
    )
  ) {
    quality = reduceQuality(quality);
    logDev(
      `Image still ${formatFileSize(fileSize)} > ${config.maxSizeKB}KB, reducing quality to ${quality}`
    );

    result = await compressWithQuality(
      uri,
      targetWidth,
      targetHeight,
      width,
      height,
      saveFormat,
      quality
    );

    fileSize = getFileSize(result.uri);
  }

  logDev(`Compression complete: ${formatFileSize(fileSize)}, quality: ${quality}`);

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: getMimeType(config.format),
    size: fileSize,
  };
}

/**
 * Internal helper to perform compression with specific quality.
 */
async function compressWithQuality(
  sourceUri: string,
  targetWidth: number,
  targetHeight: number,
  originalWidth: number,
  originalHeight: number,
  saveFormat: SaveFormat,
  quality: number
): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(sourceUri);

  // Only resize if dimensions changed
  if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
    context.resize({ width: targetWidth, height: targetHeight });
  }

  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    format: saveFormat,
    compress: quality,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
