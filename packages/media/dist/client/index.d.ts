export type MediaFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
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
    errors?: {
        key?: string;
        message?: string;
    }[];
}
export interface MediaClient {
    getUploadUrl: <TMediaType extends string = string>(options: Omit<MediaUploadOptions<TMediaType>, "file">) => Promise<MediaUploadResult & {
        headers?: Record<string, string>;
    }>;
    upload: <TMediaType extends string = string>(options: MediaUploadOptions<TMediaType>) => Promise<MediaUploadResult>;
    list: (options?: MediaListOptions) => Promise<MediaListResult>;
    getSignedUrls: (options: SignedMediaUrlsOptions) => Promise<SignedMediaUrlsResult>;
    deleteOne: (key: string) => Promise<MediaDeleteResult>;
    deleteMany: (keys: string[]) => Promise<MediaDeleteResult>;
}
export declare function createMediaClient({ basePath, fetcher, }?: CreateMediaClientOptions): MediaClient;
export { MediaError, isMediaError, shouldRetryMediaError, toMediaError } from "../errors";
export type { MediaProblem } from "../errors";
