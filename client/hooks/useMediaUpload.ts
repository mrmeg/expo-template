/**
 * Hook for uploading media files to R2/S3.
 * Gets a presigned URL from the server, then uploads directly to storage.
 */

import { useMutation } from "@tanstack/react-query";
import { api } from "@/client/api";
import type { MediaType } from "@/shared/media";

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

interface UploadOptions {
  /** The file to upload (Blob or File) */
  file: Blob | File;
  /** MIME type (e.g., "image/jpeg") */
  contentType: string;
  /** Media type from MEDIA_PATHS */
  mediaType: MediaType;
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
 * Upload a file to R2/S3 storage.
 *
 * @example
 * ```tsx
 * const { mutateAsync: upload, isPending } = useMediaUpload();
 *
 * const handleUpload = async (file: File) => {
 *   const result = await upload({
 *     file,
 *     contentType: file.type,
 *     mediaType: "products",
 *   });
 *   console.log("Uploaded to:", result.key);
 * };
 * ```
 */
export function useMediaUpload() {
  return useMutation({
    mutationFn: async (options: UploadOptions): Promise<UploadResult> => {
      const { file, contentType, mediaType } = options;

      // Get presigned upload URL
      const urlResponse = await api.post("/api/media/getUploadUrl", {
        extension: getExtension(contentType),
        mediaType,
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get upload URL");
      }

      const { uploadUrl, key }: UploadUrlResponse = await urlResponse.json();

      // Upload directly to R2/S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return { key };
    },
  });
}
