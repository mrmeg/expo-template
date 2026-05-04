import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  shouldRetryMediaError,
  type MediaClient,
  type MediaListOptions,
  type MediaUploadOptions,
  type SignedMediaUrlsOptions,
} from "../client";

export interface CreateMediaQueryHooksOptions {
  client: MediaClient;
  queryKeyNamespace?: string;
}

export type MediaKeyInput =
  | string
  | (string | null | undefined)[]
  | null
  | undefined;

export interface UseMediaListOptions extends MediaListOptions {
  enabled?: boolean;
}

export interface UseSignedMediaUrlsOptions
  extends Omit<SignedMediaUrlsOptions, "keys"> {
  mediaKeys: MediaKeyInput;
  enabled?: boolean;
}

export function createMediaQueryHooks({
  client,
  queryKeyNamespace = "media",
}: CreateMediaQueryHooksOptions) {
  const mediaListKey = (options: MediaListOptions): QueryKey => [
    queryKeyNamespace,
    "list",
    options.prefix ?? "",
    options.mediaType ?? "",
    options.limit ?? 100,
    options.cursor ?? "",
  ];

  function useMediaList({
    prefix = "",
    mediaType,
    limit = 100,
    cursor,
    enabled = true,
  }: UseMediaListOptions = {}) {
    return useQuery({
      queryKey: mediaListKey({ prefix, mediaType, limit, cursor }),
      queryFn: () => client.list({ prefix, mediaType, limit, cursor }),
      enabled,
      retry: shouldRetryMediaError,
    });
  }

  function useSignedMediaUrls({
    mediaKeys,
    path,
    enabled = true,
  }: UseSignedMediaUrlsOptions) {
    const keys = normalizeMediaKeys(mediaKeys);
    return useQuery({
      queryKey: [queryKeyNamespace, "signed-urls", keys, path ?? ""],
      queryFn: () => client.getSignedUrls({ keys, path }),
      enabled: enabled && keys.length > 0,
      retry: shouldRetryMediaError,
    });
  }

  function useMediaUpload() {
    return useMutation({
      mutationFn: (options: MediaUploadOptions) => client.upload(options),
    });
  }

  function useMediaDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (key: string) => client.deleteOne(key),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKeyNamespace, "list"] });
      },
    });
  }

  function useMediaDeleteBatch() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (keys: string[]) => client.deleteMany(keys),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKeyNamespace, "list"] });
      },
    });
  }

  return {
    useMediaList,
    useSignedMediaUrls,
    useSignedUrls: useSignedMediaUrls,
    useMediaUpload,
    useMediaDelete,
    useMediaDeleteBatch,
    queryKeys: {
      list: mediaListKey,
      signedUrls: (keys: string[], path?: string): QueryKey => [
        queryKeyNamespace,
        "signed-urls",
        keys,
        path ?? "",
      ],
    },
  };
}

function normalizeMediaKeys(input: MediaKeyInput): string[] {
  if (Array.isArray(input)) {
    return input.filter((key): key is string => typeof key === "string" && key.length > 0);
  }
  return typeof input === "string" && input.length > 0 ? [input] : [];
}

export type {
  MediaClient,
  MediaDeleteResult,
  MediaItem,
  MediaListOptions,
  MediaListResult,
  MediaUploadOptions,
  MediaUploadResult,
  SignedMediaUrlsOptions,
  SignedMediaUrlsResult,
} from "../client";
