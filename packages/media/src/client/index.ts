import { Platform } from "react-native";
import { toMediaError } from "../errors";

export type MediaFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CreateMediaClientOptions {
  basePath?: string;
  fetcher?: MediaFetcher;
}

export interface MediaUploadOptions<TMediaType extends string = string> {
  file: Blob | File | string;
  contentType: string;
  mediaType: TMediaType;
  size?: number;
  customFilename?: string;
  metadata?: unknown;
}

export interface MediaUploadResult {
  key: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface MediaListOptions {
  prefix?: string;
  mediaType?: string;
  limit?: number;
  cursor?: string;
}

export interface MediaItem {
  key: string;
  size: number;
  lastModified: string;
}

export interface MediaListResult {
  items: MediaItem[];
  totalCount: number;
  nextCursor?: string;
}

export interface SignedMediaUrlsOptions {
  keys: string[];
  path?: string;
}

export interface SignedMediaUrlsResult {
  urls: Record<string, string>;
}

export interface MediaDeleteResult {
  success: boolean;
  key?: string;
  deleted?: string[];
  errors?: { key?: string; message?: string }[];
}

export interface MediaClient {
  getUploadUrl: <TMediaType extends string = string>(
    options: Omit<MediaUploadOptions<TMediaType>, "file">,
  ) => Promise<MediaUploadResult & { headers?: Record<string, string> }>;
  upload: <TMediaType extends string = string>(
    options: MediaUploadOptions<TMediaType>,
  ) => Promise<MediaUploadResult>;
  list: (options?: MediaListOptions) => Promise<MediaListResult>;
  getSignedUrls: (options: SignedMediaUrlsOptions) => Promise<SignedMediaUrlsResult>;
  deleteOne: (key: string) => Promise<MediaDeleteResult>;
  deleteMany: (keys: string[]) => Promise<MediaDeleteResult>;
}

export function createMediaClient({
  basePath = "/api/media",
  fetcher = fetch,
}: CreateMediaClientOptions = {}): MediaClient {
  const endpoint = (path: string): string =>
    `${basePath.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  async function requestJson<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetcher(endpoint(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) throw await toMediaError(response);
    return response.json();
  }

  async function getUploadUrl<TMediaType extends string = string>(
    options: Omit<MediaUploadOptions<TMediaType>, "file">,
  ): Promise<MediaUploadResult & { headers?: Record<string, string> }> {
    return requestJson("getUploadUrl", {
      method: "POST",
      body: JSON.stringify({
        mediaType: options.mediaType,
        contentType: options.contentType,
        ...(options.size !== undefined ? { size: options.size } : {}),
        ...(options.customFilename ? { customFilename: options.customFilename } : {}),
        ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
      }),
    });
  }

  async function upload<TMediaType extends string = string>(
    options: MediaUploadOptions<TMediaType>,
  ): Promise<MediaUploadResult> {
    const size = options.size ?? (await resolveUploadSize(options.file));
    const signed = await getUploadUrl({
      contentType: options.contentType,
      mediaType: options.mediaType,
      size,
      customFilename: options.customFilename,
      metadata: options.metadata,
    });

    if (Platform.OS !== "web" && typeof options.file === "string") {
      await uploadNative(signed.uploadUrl, options.file, options.contentType);
    } else {
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": options.contentType },
        body: options.file as Blob,
      });
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
    }

    return signed;
  }

  async function list(options: MediaListOptions = {}): Promise<MediaListResult> {
    const params = new URLSearchParams();
    if (options.prefix) params.set("prefix", options.prefix);
    if (options.mediaType) params.set("mediaType", options.mediaType);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const suffix = params.toString();
    const response = await fetcher(endpoint(`list${suffix ? `?${suffix}` : ""}`), {
      method: "GET",
    });
    if (!response.ok) throw await toMediaError(response);
    return response.json();
  }

  function getSignedUrls(options: SignedMediaUrlsOptions): Promise<SignedMediaUrlsResult> {
    return requestJson("getSignedUrls", {
      method: "POST",
      body: JSON.stringify({ keys: options.keys, path: options.path }),
    });
  }

  function deleteOne(key: string): Promise<MediaDeleteResult> {
    return requestJson(`delete?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  }

  function deleteMany(keys: string[]): Promise<MediaDeleteResult> {
    return requestJson("delete", {
      method: "POST",
      body: JSON.stringify({ keys }),
    });
  }

  return {
    getUploadUrl,
    upload,
    list,
    getSignedUrls,
    deleteOne,
    deleteMany,
  };
}

/** Stats a native file URI. Injectable; the default is a lazy filesystem read. */
export type NativeFileSizeStat = (uri: string) => Promise<number | undefined>;

const statNativeFileSize: NativeFileSizeStat = async (uri) => {
  // Lazy so `expo-file-system` stays out of the eager web bundle.
  const { File: FileSystemFile } = await import("expo-file-system");
  const size = new FileSystemFile(uri).size;
  return typeof size === "number" && size > 0 ? size : undefined;
};

/**
 * Byte size of an upload payload, for the server's per-media-type `maxBytes`
 * check.
 *
 * Blobs know their own size. A native file URI does not, and returning
 * `undefined` for it — as this used to — made the size check web-only: an
 * oversized file from a phone was accepted, uploaded in full, and only then
 * failed. `expo-file-system` can stat it, so it does.
 *
 * @param stat - Overrides the filesystem read. Present because the lazy
 * `import()` only resolves inside a bundler.
 */
export async function resolveUploadSize(
  file: Blob | File | string,
  stat: NativeFileSizeStat = statNativeFileSize,
): Promise<number | undefined> {
  if (typeof file !== "string") return file.size;
  if (Platform.OS === "web") return undefined;

  try {
    return await stat(file);
  } catch {
    // An unstattable URI still uploads; the server enforces the cap on receipt.
    return undefined;
  }
}

async function uploadNative(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const [{ File }, { fetch: expoFetch }] = await Promise.all([
    import("expo-file-system"),
    import("expo/fetch"),
  ]);
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

export { MediaError, isMediaError, shouldRetryMediaError, toMediaError } from "../errors";
export type { MediaProblem } from "../errors";
