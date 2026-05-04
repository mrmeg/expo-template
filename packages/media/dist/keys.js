import { normalizeMediaPrefix, resolveContentTypeExtension, } from "./config.js";
export function sanitizeFilenameBase(input) {
    const value = input.trim();
    if (!value)
        return null;
    if (/[\\/\u0000-\u001f\u007f]/.test(value))
        return null;
    if (value.includes(".."))
        return null;
    const withoutExtension = value.replace(/\.[^.]+$/, "");
    const sanitized = withoutExtension
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9._-]/g, "")
        .replace(/^[.-]+|[.-]+$/g, "");
    return sanitized || null;
}
export function isSafeObjectKey(key) {
    if (!key || key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
        return false;
    }
    const parts = key.split("/");
    return parts.every((part) => part !== "" && part !== "." && part !== "..");
}
export function joinMediaKey(prefix, filename) {
    return `${normalizeMediaPrefix(prefix)}/${filename}`;
}
export function buildMediaKey(mediaTypeConfig, options) {
    const extension = resolveContentTypeExtension(options.contentType);
    if (!extension)
        return null;
    const base = options.customFilename
        ? sanitizeFilenameBase(options.customFilename)
        : sanitizeFilenameBase(options.id);
    if (!base)
        return null;
    return joinMediaKey(mediaTypeConfig.prefix, `${base}.${extension}`);
}
export function mediaTypeForKey(config, key) {
    if (!isSafeObjectKey(key))
        return null;
    const matches = Object.entries(config.mediaTypes)
        .map(([mediaType, settings]) => ({
        mediaType,
        prefix: normalizeMediaPrefix(settings.prefix),
    }))
        .filter(({ prefix }) => key === prefix || key.startsWith(`${prefix}/`))
        .sort((a, b) => b.prefix.length - a.prefix.length);
    return matches[0]?.mediaType ?? null;
}
export function resolveRequestedKey(config, key, path) {
    if (typeof key !== "string" || key.trim() === "")
        return null;
    const fullKey = path ? joinMediaKey(path, key) : key;
    if (!isSafeObjectKey(fullKey))
        return null;
    const mediaType = mediaTypeForKey(config, fullKey);
    if (!mediaType)
        return null;
    return { key: fullKey, mediaType };
}
