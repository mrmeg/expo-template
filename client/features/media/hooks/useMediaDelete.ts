/**
 * Hook for deleting media files from R2/S3 storage.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api/authenticatedFetch";
import { toMediaError } from "@/client/features/media/lib/problem";

interface DeleteResult {
  success: boolean;
  key?: string;
  deleted?: string[];
  errors?: { key: string; message: string }[];
}

/**
 * Delete a single file from storage.
 *
 * @example
 * ```tsx
 * const { mutateAsync: deleteFile, isPending } = useMediaDelete();
 *
 * await deleteFile("products/images/photo.jpg");
 * ```
 */
export function useMediaDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string): Promise<DeleteResult> => {
      const response = await api.delete(`/api/media/delete?key=${encodeURIComponent(key)}`);

      if (!response.ok) {
        throw await toMediaError(response);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-list"] });
    },
  });
}

/**
 * Delete multiple files from storage in a single request.
 *
 * @example
 * ```tsx
 * const { mutateAsync: deleteFiles, isPending } = useMediaDeleteBatch();
 *
 * await deleteFiles([
 *   "products/images/photo1.jpg",
 *   "products/images/photo2.jpg",
 * ]);
 * ```
 */
export function useMediaDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keys: string[]): Promise<DeleteResult> => {
      const response = await api.post("/api/media/delete", { keys });

      if (!response.ok) {
        throw await toMediaError(response);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-list"] });
    },
  });
}
