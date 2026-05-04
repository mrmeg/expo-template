import { type QueryKey } from "@tanstack/react-query";
import { type MediaClient, type MediaListOptions, type MediaUploadOptions, type SignedMediaUrlsOptions } from "../client";
export interface CreateMediaQueryHooksOptions {
    client: MediaClient;
    queryKeyNamespace?: string;
}
export type MediaKeyInput = string | (string | null | undefined)[] | null | undefined;
export interface UseMediaListOptions extends MediaListOptions {
    enabled?: boolean;
}
export interface UseSignedMediaUrlsOptions extends Omit<SignedMediaUrlsOptions, "keys"> {
    mediaKeys: MediaKeyInput;
    enabled?: boolean;
}
export declare function createMediaQueryHooks({ client, queryKeyNamespace, }: CreateMediaQueryHooksOptions): {
    useMediaList: ({ prefix, mediaType, limit, cursor, enabled, }?: UseMediaListOptions) => import("@tanstack/react-query").UseQueryResult<import(".").MediaListResult, unknown>;
    useSignedMediaUrls: ({ mediaKeys, path, enabled, }: UseSignedMediaUrlsOptions) => import("@tanstack/react-query").UseQueryResult<import(".").SignedMediaUrlsResult, unknown>;
    useSignedUrls: ({ mediaKeys, path, enabled, }: UseSignedMediaUrlsOptions) => import("@tanstack/react-query").UseQueryResult<import(".").SignedMediaUrlsResult, unknown>;
    useMediaUpload: () => import("@tanstack/react-query").UseMutationResult<import(".").MediaUploadResult, Error, MediaUploadOptions<string>, unknown>;
    useMediaDelete: () => import("@tanstack/react-query").UseMutationResult<import(".").MediaDeleteResult, Error, string, unknown>;
    useMediaDeleteBatch: () => import("@tanstack/react-query").UseMutationResult<import(".").MediaDeleteResult, Error, string[], unknown>;
    queryKeys: {
        list: (options: MediaListOptions) => QueryKey;
        signedUrls: (keys: string[], path?: string) => QueryKey;
    };
};
export type { MediaClient, MediaDeleteResult, MediaItem, MediaListOptions, MediaListResult, MediaUploadOptions, MediaUploadResult, SignedMediaUrlsOptions, SignedMediaUrlsResult, } from "../client";
