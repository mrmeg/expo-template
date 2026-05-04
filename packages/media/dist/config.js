export const DEFAULT_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "application/pdf": "pdf",
};
export function createMediaConfig(config) {
    return config;
}
export function isBlank(value) {
    return typeof value !== "string" || value.trim() === "";
}
export function normalizeMediaPrefix(prefix) {
    return prefix
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .join("/");
}
export function resolveContentTypeExtension(contentType) {
    const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
    return DEFAULT_CONTENT_TYPE_EXTENSIONS[normalized] ?? null;
}
export function getMediaTypeNames(config) {
    return Object.keys(config.mediaTypes);
}
export function validateMediaConfig(config) {
    const missing = [];
    const errors = [];
    if (config.disabled?.missing?.length || config.disabled?.details?.length) {
        missing.push(...(config.disabled.missing ?? []));
        errors.push(...(config.disabled.details ?? []));
        return { valid: false, missing, errors };
    }
    for (const [bucketName, bucket] of Object.entries(config.buckets)) {
        if (isBlank(bucket.bucket))
            missing.push(`buckets.${bucketName}.bucket`);
        if (isBlank(bucket.region))
            missing.push(`buckets.${bucketName}.region`);
        if (isBlank(bucket.credentials?.accessKeyId)) {
            missing.push(`buckets.${bucketName}.credentials.accessKeyId`);
        }
        if (isBlank(bucket.credentials?.secretAccessKey)) {
            missing.push(`buckets.${bucketName}.credentials.secretAccessKey`);
        }
        if (bucket.provider === "r2" && isBlank(bucket.endpoint)) {
            missing.push(`buckets.${bucketName}.endpoint`);
        }
    }
    for (const [mediaType, settings] of Object.entries(config.mediaTypes)) {
        if (!(settings.bucket in config.buckets)) {
            errors.push(`mediaTypes.${mediaType}.bucket references an unknown bucket`);
        }
        const prefix = normalizeMediaPrefix(settings.prefix);
        if (!prefix) {
            errors.push(`mediaTypes.${mediaType}.prefix must not be empty`);
        }
        if (prefix.includes("..")) {
            errors.push(`mediaTypes.${mediaType}.prefix must not contain traversal`);
        }
        if (!Array.isArray(settings.allowedContentTypes) || settings.allowedContentTypes.length === 0) {
            errors.push(`mediaTypes.${mediaType}.allowedContentTypes must not be empty`);
        }
    }
    return { valid: missing.length === 0 && errors.length === 0, missing, errors };
}
export function getMediaTypeConfig(config, mediaType) {
    return config.mediaTypes[mediaType] ?? null;
}
export function getBucketConfig(config, mediaType) {
    const mediaTypeConfig = getMediaTypeConfig(config, mediaType);
    if (!mediaTypeConfig)
        return null;
    return config.buckets[mediaTypeConfig.bucket] ?? null;
}
export function isAllowedContentType(settings, contentType) {
    const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
    return settings.allowedContentTypes.some((allowed) => allowed.toLowerCase() === normalized);
}
