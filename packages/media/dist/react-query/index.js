import { useMutation, useQuery, useQueryClient, } from "@tanstack/react-query";
import { shouldRetryMediaError, } from "../client/index.js";
export function createMediaQueryHooks({ client, queryKeyNamespace = "media", }) {
    const mediaListKey = (options) => [
        queryKeyNamespace,
        "list",
        options.prefix ?? "",
        options.mediaType ?? "",
        options.limit ?? 100,
        options.cursor ?? "",
    ];
    function useMediaList({ prefix = "", mediaType, limit = 100, cursor, enabled = true, } = {}) {
        return useQuery({
            queryKey: mediaListKey({ prefix, mediaType, limit, cursor }),
            queryFn: () => client.list({ prefix, mediaType, limit, cursor }),
            enabled,
            retry: shouldRetryMediaError,
        });
    }
    function useSignedMediaUrls({ mediaKeys, path, enabled = true, }) {
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
            mutationFn: (options) => client.upload(options),
        });
    }
    function useMediaDelete() {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (key) => client.deleteOne(key),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [queryKeyNamespace, "list"] });
            },
        });
    }
    function useMediaDeleteBatch() {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (keys) => client.deleteMany(keys),
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
            signedUrls: (keys, path) => [
                queryKeyNamespace,
                "signed-urls",
                keys,
                path ?? "",
            ],
        },
    };
}
function normalizeMediaKeys(input) {
    if (Array.isArray(input)) {
        return input.filter((key) => typeof key === "string" && key.length > 0);
    }
    return typeof input === "string" && input.length > 0 ? [input] : [];
}
