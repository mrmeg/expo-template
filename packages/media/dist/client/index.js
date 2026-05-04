import { Platform } from "react-native";
import { toMediaError } from "../errors.js";
export function createMediaClient({ basePath = "/api/media", fetcher = fetch, } = {}) {
    const endpoint = (path) => `${basePath.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    async function requestJson(path, init) {
        const response = await fetcher(endpoint(path), {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
            },
        });
        if (!response.ok)
            throw await toMediaError(response);
        return response.json();
    }
    async function getUploadUrl(options) {
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
    async function upload(options) {
        const size = options.size ?? getUploadSize(options.file);
        const signed = await getUploadUrl({
            contentType: options.contentType,
            mediaType: options.mediaType,
            size,
            customFilename: options.customFilename,
            metadata: options.metadata,
        });
        if (Platform.OS !== "web" && typeof options.file === "string") {
            await uploadNative(signed.uploadUrl, options.file, options.contentType);
        }
        else {
            const response = await fetch(signed.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": options.contentType },
                body: options.file,
            });
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
        }
        return signed;
    }
    async function list(options = {}) {
        const params = new URLSearchParams();
        if (options.prefix)
            params.set("prefix", options.prefix);
        if (options.mediaType)
            params.set("mediaType", options.mediaType);
        if (options.limit)
            params.set("limit", String(options.limit));
        if (options.cursor)
            params.set("cursor", options.cursor);
        const suffix = params.toString();
        const response = await fetcher(endpoint(`list${suffix ? `?${suffix}` : ""}`), {
            method: "GET",
        });
        if (!response.ok)
            throw await toMediaError(response);
        return response.json();
    }
    function getSignedUrls(options) {
        return requestJson("getSignedUrls", {
            method: "POST",
            body: JSON.stringify({ keys: options.keys, path: options.path }),
        });
    }
    function deleteOne(key) {
        return requestJson(`delete?key=${encodeURIComponent(key)}`, {
            method: "DELETE",
        });
    }
    function deleteMany(keys) {
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
function getUploadSize(file) {
    if (typeof file === "string")
        return undefined;
    return file.size;
}
async function uploadNative(uploadUrl, fileUri, contentType) {
    const { File } = await import("expo-file-system");
    const { fetch: expoFetch } = await import("expo/fetch");
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
export { MediaError, isMediaError, shouldRetryMediaError, toMediaError } from "../errors.js";
