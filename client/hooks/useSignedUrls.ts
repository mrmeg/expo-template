import { useQuery } from "@tanstack/react-query";
import { api } from "@/client/api";
import type { MediaPath } from "@/shared/media";

interface MediaResponse {
  urls: {
    [key: string]: string;
  };
}

type MediaKeyType = string | (string | null | undefined)[] | null | undefined;

interface UseSignedUrlsOptions {
  mediaKeys: MediaKeyType;
  endpoint?: string;
  /** Path prefix in bucket (use MEDIA_PATHS constants or any string) */
  path: MediaPath | string;
  enabled?: boolean;
}

export function useSignedUrls({
  mediaKeys,
  endpoint = "/api/media/getSignedUrls",
  path,
  enabled = true,
}: UseSignedUrlsOptions) {
  return useQuery({
    queryKey: ["signed-urls", mediaKeys, endpoint, path],
    queryFn: async (): Promise<MediaResponse> => {
      const keys = Array.isArray(mediaKeys) ? mediaKeys : [mediaKeys];

      const response = await api.post(endpoint, {
        keys,
        path,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch media");
      }

      return response.json();
    },
    enabled: enabled && (Array.isArray(mediaKeys) ? mediaKeys.length > 0 : !!mediaKeys),
  });
}
