import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type StaleTime,
} from "@tanstack/react-query";
import {
  shouldRetryMediaError,
  type MediaClient,
  type MediaListOptions,
  type MediaUploadOptions,
  type SignedMediaUrlsOptions,
  type SignedMediaUrlsResult,
} from "../client";
import { signedUrlExpiresAt, signedUrlRefreshAt } from "./signedUrlLifetime";

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

/**
 * What `useSignedMediaUrls` holds for one key list: the server's response, plus
 * when each URL in it stops working.
 */
export interface SignedMediaUrlsData extends SignedMediaUrlsResult {
  /**
   * Epoch milliseconds, on this device's clock, at which each URL in `urls`
   * expires; keyed like `urls`. Read off the URL when it arrived — its lifetime
   * (`X-Amz-Expires`, `X-Goog-Expires`) or its expiry (`Expires`). A URL that
   * states neither has no entry and is never reused for another key list.
   */
  urlExpiresAt?: Record<string, number>;
}

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

/** The parts of a cached query the freshness math reads. */
interface SignedUrlsQueryState {
  queryKey: QueryKey;
  state: { data?: unknown; dataUpdatedAt: number };
}

function isSignedUrlsData(data: unknown): data is SignedMediaUrlsData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as SignedMediaUrlsData).urls === "object" &&
    (data as SignedMediaUrlsData).urls !== null
  );
}

/**
 * The expiry recorded for `key`, or estimated from the URL and the time the
 * result was stored: data put in the cache by `setQueryData`, or by an older
 * version of these hooks, carries no `urlExpiresAt`.
 */
function cachedExpiresAt(
  data: SignedMediaUrlsData,
  key: string,
  url: string,
  dataUpdatedAt: number,
): number | null {
  const recorded = data.urlExpiresAt?.[key];
  if (typeof recorded === "number" && Number.isFinite(recorded)) return recorded;
  return signedUrlExpiresAt(url, dataUpdatedAt);
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

  const signedUrlsKey = (keys: string[], path?: string): QueryKey => [
    queryKeyNamespace,
    "signed-urls",
    keys,
    path ?? "",
  ];

  /**
   * Fresh URLs the cache already holds for `path`, by object key, across every
   * signed-URL query of this namespace. An invalidated query is not a source:
   * invalidating is how an app asks for new URLs.
   */
  function reusableSignedUrls(
    queryClient: QueryClient,
    path: string,
    now: number,
  ): Map<string, CachedSignedUrl> {
    const reusable = new Map<string, CachedSignedUrl>();
    const queries = queryClient
      .getQueryCache()
      .findAll({ queryKey: [queryKeyNamespace, "signed-urls"] });
    for (const query of queries) {
      if ((query.queryKey[3] ?? "") !== path) continue;
      if (query.state.isInvalidated) continue;
      const data = query.state.data;
      if (!isSignedUrlsData(data)) continue;
      for (const [key, url] of Object.entries(data.urls)) {
        if (typeof url !== "string") continue;
        const expiresAt = cachedExpiresAt(data, key, url, query.state.dataUpdatedAt);
        if (expiresAt === null || now >= signedUrlRefreshAt(url, expiresAt)) continue;
        const known = reusable.get(key);
        // The newest URL is the one most likely already on screen.
        if (!known || known.expiresAt < expiresAt) reusable.set(key, { url, expiresAt });
      }
    }
    return reusable;
  }

  /** The cached URLs for `keys`, in key order; keys without one are left out. */
  function signedUrlsFrom(
    keys: string[],
    reusable: Map<string, CachedSignedUrl>,
  ): Required<SignedMediaUrlsData> {
    const urls: Record<string, string> = {};
    const urlExpiresAt: Record<string, number> = {};
    for (const key of keys) {
      const cached = reusable.get(key);
      if (!cached) continue;
      urls[key] = cached.url;
      urlExpiresAt[key] = cached.expiresAt;
    }
    return { urls, urlExpiresAt };
  }

  /**
   * Signs only what the cache cannot supply. A key list fetching for the first
   * time — the list after an upload or a delete — reuses the fresh URLs other
   * lists hold and asks the server for the rest, so an unchanged item keeps its
   * URL and is not downloaded again. A refetch of a list that already has data
   * (invalidated, `refetch()`, or stale) re-signs every key: that is what it
   * was asked to do.
   */
  async function fetchSignedUrls(
    queryClient: QueryClient,
    queryKey: QueryKey,
    keys: string[],
    path: string | undefined,
  ): Promise<SignedMediaUrlsData> {
    const own = queryClient.getQueryCache().find({ queryKey, exact: true });
    const reusable =
      own?.state.data === undefined
        ? reusableSignedUrls(queryClient, path ?? "", Date.now())
        : new Map<string, CachedSignedUrl>();
    const missing = [...new Set(keys.filter((key) => !reusable.has(key)))];

    if (missing.length === 0) return signedUrlsFrom(keys, reusable);

    const signed = await client.getSignedUrls({ keys: missing, path });
    const receivedAt = Date.now();
    const fetched = new Map<string, CachedSignedUrl>();
    const unstated: Record<string, string> = {};
    for (const key of missing) {
      const url = signed.urls?.[key];
      if (typeof url !== "string") continue;
      const expiresAt = signedUrlExpiresAt(url, receivedAt);
      if (expiresAt === null) unstated[key] = url;
      else fetched.set(key, { url, expiresAt });
    }

    const merged = signedUrlsFrom(keys, new Map([...reusable, ...fetched]));
    // Anything else the server returned stays visible to the app, as before.
    return { ...signed, urls: { ...merged.urls, ...unstated }, urlExpiresAt: merged.urlExpiresAt };
  }

  /**
   * Fresh until the first of its URLs is due for replacement. A list whose URLs
   * state no lifetime keeps the app's default `staleTime`, which is what these
   * hooks used before they read lifetimes.
   */
  function signedUrlsStaleTime(
    queryClient: QueryClient,
    query: SignedUrlsQueryState,
  ): StaleTime {
    const data = query.state.data;
    if (!isSignedUrlsData(data)) return 0;
    let refreshAt = Infinity;
    for (const [key, url] of Object.entries(data.urls)) {
      if (typeof url !== "string") continue;
      const expiresAt = cachedExpiresAt(data, key, url, query.state.dataUpdatedAt);
      if (expiresAt !== null) refreshAt = Math.min(refreshAt, signedUrlRefreshAt(url, expiresAt));
    }
    if (refreshAt !== Infinity) return Math.max(0, refreshAt - query.state.dataUpdatedAt);

    const fallback =
      queryClient.getQueryDefaults(query.queryKey).staleTime ??
      queryClient.getDefaultOptions().queries?.staleTime;
    if (typeof fallback === "function") {
      return (fallback as (query: SignedUrlsQueryState) => StaleTime)(query);
    }
    return fallback ?? 0;
  }

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

  /**
   * Signed read URLs for a list of object keys.
   *
   * The query key is still the whole list (`queryKeys.signedUrls(keys, path)`),
   * but URLs are reused per object key: a changed list signs only the keys no
   * cached list has a fresh URL for. While those sign, `data` holds the URLs
   * already cached for the rest (`isPlaceholderData` is true) instead of
   * `undefined`; a list the cache can serve entirely starts with data and does
   * not fetch. `staleTime` follows the URLs' own lifetime, less a margin.
   */
  function useSignedMediaUrls({
    mediaKeys,
    path,
    enabled = true,
  }: UseSignedMediaUrlsOptions) {
    const queryClient = useQueryClient();
    const keys = normalizeMediaKeys(mediaKeys);
    const queryKey = signedUrlsKey(keys, path);
    const isEnabled = enabled && keys.length > 0;

    return useQuery({
      queryKey,
      queryFn: () => fetchSignedUrls(queryClient, queryKey, keys, path),
      enabled: isEnabled,
      retry: shouldRetryMediaError,
      staleTime: (query) => signedUrlsStaleTime(queryClient, query),
      // The cache's fresh URLs for this list, when it has every one of them.
      initialData: (): SignedMediaUrlsData | undefined => {
        if (!isEnabled) return undefined;
        const reusable = reusableSignedUrls(queryClient, path ?? "", Date.now());
        return keys.every((key) => reusable.has(key))
          ? signedUrlsFrom(keys, reusable)
          : undefined;
      },
      // Whatever part of this list the cache can already show.
      placeholderData: (): SignedMediaUrlsData | undefined => {
        if (!isEnabled) return undefined;
        const partial = signedUrlsFrom(
          keys,
          reusableSignedUrls(queryClient, path ?? "", Date.now()),
        );
        return Object.keys(partial.urls).length > 0 ? partial : undefined;
      },
    });
  }

  function useMediaUpload() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (options: MediaUploadOptions) => client.upload(options),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKeyNamespace, "list"] });
      },
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
      signedUrls: signedUrlsKey,
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
