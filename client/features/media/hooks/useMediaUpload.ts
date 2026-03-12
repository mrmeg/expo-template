/**
 * Hook for uploading media files to R2/S3.
 * Gets a presigned URL from the server, then uploads directly to storage.
 *
 * Platform handling:
 * - Web: Uses fetch with Blob body
 * - Native: Uses expo-file-system File class with expo/fetch for streaming
 */

import { useMutation } from "@tanstack/react-query";
import { Platform } from "react-native";
import { api } from "@/client/api";
import type { MediaType } from "@/shared/media";

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

interface UploadOptions {
  /** The file to upload - Blob/File on web, or file URI string on native */
  file: Blob | File | string;
  /** MIME type (e.g., "image/jpeg") */
  contentType: string;
  /** Media type from MEDIA_PATHS */
  mediaType: MediaType;
  /** Optional custom filename (without extension) - useful for thumbnails that need to match video keys */
  customFilename?: string;
}

interface UploadResult {
  /** The storage key for retrieving the file later */
  key: string;
}

/**
 * Get file extension from MIME type.
 */
function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[contentType] || "bin";
}

/**
 * Upload file using expo-file-system File class with expo/fetch (native only).
 * Streams the file efficiently without loading into memory.
 */
async function uploadNative(
  uploadUrl: string,
  fileUri: string,
  contentType: string
): Promise<void> {
  // Dynamic imports to avoid bundling on web
  const { File } = await import("expo-file-system");
  const { fetch: expoFetch } = await import("expo/fetch");

  // Create a File object from the existing URI
  const file = new File(fileUri);

  const response = await expoFetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Upload a file to R2/S3 storage.
 *
 * @example
 * ```tsx
 * const { mutateAsync: upload, isPending } = useMediaUpload();
 *
 * // Web - pass blob
 * const result = await upload({
 *   file: blob,
 *   contentType: "image/jpeg",
 *   mediaType: "products",
 * });
 *
 * // Native - pass URI string
 * const result = await upload({
 *   file: "file:///path/to/image.jpg",
 *   contentType: "image/jpeg",
 *   mediaType: "products",
 * });
 * ```
 */
export function useMediaUpload() {
  return useMutation({
    mutationFn: async (options: UploadOptions): Promise<UploadResult> => {
      const { file, contentType, mediaType, customFilename } = options;

      // Get presigned upload URL
      const urlResponse = await api.post("/api/media/getUploadUrl", {
        extension: getExtension(contentType),
        mediaType,
        ...(customFilename && { customFilename }),
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get upload URL");
      }

      const { uploadUrl, key }: UploadUrlResponse = await urlResponse.json();

      // Upload directly to R2/S3
      if (Platform.OS !== "web" && typeof file === "string") {
        // Native: Use expo-file-system for efficient streaming upload
        await uploadNative(uploadUrl, file, contentType);
      } else {
        // Web: Use fetch with blob body
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file as Blob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
      }

      return { key };
    },
  });
}
