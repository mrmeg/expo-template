/**
 * Hook for listing media files from R2/S3 storage.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/client/api";

interface MediaItem {
  key: string;
  size: number;
  lastModified: string;
}

interface ListResponse {
  items: MediaItem[];
  totalCount: number;
  nextCursor?: string;
}

interface UseMediaListOptions {
  /** Filter by path prefix (e.g., "products/images") */
  prefix?: string;
  /** Max items to return (default: 100, max: 1000) */
  limit?: number;
  /** Pagination cursor from previous response */
  cursor?: string;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * List media files in the bucket.
 *
 * @example
 * ```tsx
 * // List all files
 * const { data } = useMediaList();
 *
 * // List files in a specific folder
 * const { data } = useMediaList({ prefix: "products/images" });
 *
 * // Paginated
 * const { data } = useMediaList({ limit: 50, cursor: nextCursor });
 * ```
 */
export function useMediaList({
  prefix = "",
  limit = 100,
  cursor,
  enabled = true,
}: UseMediaListOptions = {}) {
  return useQuery({
    queryKey: ["media-list", prefix, limit, cursor],
    queryFn: async (): Promise<ListResponse> => {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);
      if (limit) params.set("limit", String(limit));
      if (cursor) params.set("cursor", cursor);

      const url = `/api/media/list?${params.toString()}`;
      const response = await api.get(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to list media");
      }

      return response.json();
    },
    enabled,
  });
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
