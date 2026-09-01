import { ulid } from "ulid";
import { getBucketConfig, getMediaTypeConfig, getMediaTypeNames, isAllowedContentType, normalizeMediaPrefix, validateMediaConfig, } from "../config.js";
import { buildMediaKey, isSafeObjectKey, mediaTypeForKey, resolveRequestedKey, } from "../keys.js";
import { deleteObject, getBucketClientCacheKey, listObjects, presignGetUrl, presignPutUrl, } from "./storage.js";
export { resetMediaStorageForTests } from "./storage.js";
const DELETE_CONCURRENCY = 10;
export function createMediaHandlers(options) {
    const idFactory = options.idFactory ?? ulid;
    const getConfig = () => typeof options.config === "function" ? options.config() : options.config;
    async function optionsHandler(request) {
        return new Response(null, {
            status: 200,
            headers: options.cors?.getPreflightHeaders?.(request) ?? {},
        });
    }
    async function getUploadUrl(request) {
        const ready = getReadyConfig(request, getConfig(), options.cors);
        if (ready instanceof Response)
            return ready;
        const { config } = ready;
        const authOrResponse = await authorize(request, options);
        if (authOrResponse instanceof Response)
            return authOrResponse;
        const auth = authOrResponse;
        let body;
        try {
            body = await request.json();
        }
        catch {
            return problem(request, options.cors, 400, "bad-request", "Request body must be JSON.");
        }
        if (typeof body.mediaType !== "string") {
            return problem(request, options.cors, 400, "invalid-media-type", "Missing or invalid mediaType.", {
                validTypes: getMediaTypeNames(config),
            });
        }
        if (typeof body.contentType !== "string" || body.contentType.trim() === "") {
            return problem(request, options.cors, 400, "invalid-content-type", "Missing or invalid contentType.");
        }
        const mediaTypeConfig = getMediaTypeConfig(config, body.mediaType);
        if (!mediaTypeConfig) {
            return problem(request, options.cors, 400, "invalid-media-type", "Unknown mediaType.", {
                validTypes: getMediaTypeNames(config),
            });
        }
        if (!isAllowedContentType(mediaTypeConfig, body.contentType)) {
            return problem(request, options.cors, 400, "invalid-content-type", "Content type is not allowed for this media type.");
        }
        const size = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : undefined;
        if (size !== undefined && mediaTypeConfig.maxBytes !== undefined && size > mediaTypeConfig.maxBytes) {
            return problem(request, options.cors, 400, "oversized-file", "File exceeds this media type's maximum size.", {
                maxBytes: mediaTypeConfig.maxBytes,
            });
        }
        const customFilename = typeof body.customFilename === "string" && body.customFilename.trim() !== ""
            ? body.customFilename
            : undefined;
        const policy = normalizePolicyDecision(await options.policy?.canUpload?.({
            request,
            auth,
            mediaType: body.mediaType,
            contentType: body.contentType,
            size,
            customFilename,
            metadata: body.metadata,
        }));
        if (!policy.allowed) {
            return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "Upload is not allowed.");
        }
        if (customFilename && !policy.allowCustomFilename) {
            return problem(request, options.cors, 403, "custom-filename-forbidden", "Custom filenames are not allowed by policy.");
        }
        const key = buildMediaKey(mediaTypeConfig, {
            mediaType: body.mediaType,
            contentType: body.contentType,
            id: idFactory(),
            customFilename,
        });
        if (!key) {
            return problem(request, options.cors, 400, "bad-key", "Could not build a safe storage key for this upload.");
        }
        const bucket = getBucketConfig(config, body.mediaType);
        if (!bucket) {
            return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");
        }
        const expiresIn = mediaTypeConfig.uploadExpiresInSeconds ?? 300;
        try {
            const uploadUrl = await presignPutUrl({
                bucket,
                key,
                contentType: body.contentType,
                expiresIn,
            });
            await options.events?.onUploadSigned?.({
                request,
                auth,
                key,
                mediaType: body.mediaType,
                contentType: body.contentType,
                metadata: body.metadata,
            });
            return json(request, options.cors, 200, {
                uploadUrl,
                key,
                expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
                headers: {
                    "Content-Type": body.contentType,
                },
            });
        }
        catch (error) {
            return storageFailure(request, options.cors, "Failed to create upload URL.", error);
        }
    }
    async function getSignedUrls(request) {
        const ready = getReadyConfig(request, getConfig(), options.cors);
        if (ready instanceof Response)
            return ready;
        const { config } = ready;
        const authOrResponse = await authorize(request, options);
        if (authOrResponse instanceof Response)
            return authOrResponse;
        const auth = authOrResponse;
        const body = await request.json().catch(() => ({}));
        const keys = Array.isArray(body.keys)
            ? body.keys.filter((key) => typeof key === "string" && key.trim() !== "")
            : [];
        const path = typeof body.path === "string" && body.path.trim() !== "" ? body.path : undefined;
        if (keys.length === 0) {
            return problem(request, options.cors, 400, "bad-request", "Missing or invalid keys.");
        }
        const resolved = resolveKeys(config, keys, path);
        if (!resolved) {
            return problem(request, options.cors, 400, "bad-key", "One or more keys are outside configured media prefixes.");
        }
        const policy = normalizePolicyDecision(await options.policy?.canRead?.({
            request,
            auth,
            keys: resolved.keys,
            mediaTypes: resolved.mediaTypes,
        }));
        if (!policy.allowed) {
            return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "Read is not allowed.");
        }
        const urls = {};
        try {
            const urlEntries = await Promise.all(resolved.keys.map(async (key, index) => {
                const mediaType = resolved.mediaTypes[index];
                const bucket = getBucketConfig(config, mediaType);
                const mediaTypeConfig = getMediaTypeConfig(config, mediaType);
                if (!bucket)
                    throw new Error(`Missing bucket for ${mediaType}`);
                const url = await presignGetUrl({
                    bucket,
                    key,
                    expiresIn: mediaTypeConfig.readExpiresInSeconds ?? 86400,
                });
                return [keys[index], url];
            }));
            Object.assign(urls, Object.fromEntries(urlEntries));
            return json(request, options.cors, 200, { urls });
        }
        catch (error) {
            return storageFailure(request, options.cors, "Failed to create signed URLs.", error);
        }
    }
    async function list(request) {
        const ready = getReadyConfig(request, getConfig(), options.cors);
        if (ready instanceof Response)
            return ready;
        const { config } = ready;
        const authOrResponse = await authorize(request, options);
        if (authOrResponse instanceof Response)
            return authOrResponse;
        const auth = authOrResponse;
        const url = new URL(request.url);
        const requestedPrefix = url.searchParams.get("prefix");
        const cursor = url.searchParams.get("cursor") || undefined;
        const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(requestedLimit, 1000) : 100;
        const mediaType = url.searchParams.get("mediaType") || undefined;
        const scope = resolveListScope(config, mediaType, requestedPrefix, request, options.cors);
        if (scope instanceof Response)
            return scope;
        const policy = normalizePolicyDecision(await options.policy?.canList?.({
            request,
            auth,
            mediaType: scope.mediaType,
            prefix: scope.prefix,
        }));
        if (!policy.allowed) {
            return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "List is not allowed.");
        }
        const bucket = getBucketConfig(config, scope.mediaType);
        if (!bucket)
            return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");
        try {
            const result = await listObjects({
                bucket,
                prefix: scope.prefix,
                maxKeys: limit,
                continuationToken: cursor,
            });
            return json(request, options.cors, 200, {
                items: result.items,
                totalCount: result.items.length,
                nextCursor: result.nextContinuationToken,
            });
        }
        catch (error) {
            return storageFailure(request, options.cors, "Failed to list media.", error);
        }
    }
    async function deleteOne(request) {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key) {
            return problem(request, options.cors, 400, "bad-request", "Missing key parameter.");
        }
        return deleteKeys(request, [key], false);
    }
    async function deleteMany(request) {
        const body = await request.json().catch(() => ({}));
        if (!Array.isArray(body.keys) || body.keys.length === 0) {
            return problem(request, options.cors, 400, "bad-request", "Missing or invalid keys array.");
        }
        if (body.keys.length > 1000) {
            return problem(request, options.cors, 400, "bad-request", "Maximum 1000 keys per request.");
        }
        const keys = body.keys.filter((key) => typeof key === "string" && key.trim() !== "");
        if (keys.length !== body.keys.length) {
            return problem(request, options.cors, 400, "bad-request", "Keys must be non-empty strings.");
        }
        return deleteKeys(request, keys, true);
    }
    async function deleteKeys(request, keys, batch) {
        const ready = getReadyConfig(request, getConfig(), options.cors);
        if (ready instanceof Response)
            return ready;
        const { config } = ready;
        const authOrResponse = await authorize(request, options);
        if (authOrResponse instanceof Response)
            return authOrResponse;
        const auth = authOrResponse;
        const resolved = resolveKeys(config, keys);
        if (!resolved) {
            return problem(request, options.cors, 400, "bad-key", "One or more keys are outside configured media prefixes.");
        }
        const policy = normalizePolicyDecision(await options.policy?.canDelete?.({
            request,
            auth,
            keys: resolved.keys,
            mediaTypes: resolved.mediaTypes,
        }));
        if (!policy.allowed) {
            return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "Delete is not allowed.");
        }
        const deleteGroups = groupDeleteKeysByBucket(config, resolved.keys, resolved.mediaTypes);
        if (!deleteGroups) {
            return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");
        }
        try {
            if (!batch) {
                const bucket = deleteGroups[0]?.bucket;
                if (!bucket)
                    return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");
                await deleteObject({ bucket, key: resolved.keys[0] });
                await options.events?.onDeleted?.({ request, auth, keys: resolved.keys });
                return json(request, options.cors, 200, { success: true, key: resolved.keys[0] });
            }
            const tasks = deleteGroups.flatMap((group) => group.keys.map((key) => ({ bucket: group.bucket, key })));
            const settled = await settleWithConcurrency(tasks, DELETE_CONCURRENCY, (task) => deleteObject({ bucket: task.bucket, key: task.key }));
            const deleted = [];
            const errors = [];
            for (let index = 0; index < settled.length; index += 1) {
                const taskResult = settled[index];
                const key = tasks[index].key;
                if (taskResult.status === "fulfilled") {
                    deleted.push(key);
                    continue;
                }
                errors.push({ key, message: getErrorMessage(taskResult.reason) });
            }
            if (deleted.length > 0) {
                await options.events?.onDeleted?.({ request, auth, keys: deleted });
            }
            return json(request, options.cors, 200, {
                success: errors.length === 0,
                deleted,
                errors,
            });
        }
        catch (error) {
            return storageFailure(request, options.cors, batch ? "Failed to delete files." : "Failed to delete file.", error);
        }
    }
    return {
        options: optionsHandler,
        getUploadUrl,
        getSignedUrls,
        list,
        deleteOne,
        deleteMany,
    };
}
function resolveListScope(config, mediaType, requestedPrefix, request, cors) {
    if (mediaType) {
        const mediaTypeConfig = getMediaTypeConfig(config, mediaType);
        if (!mediaTypeConfig) {
            return problem(request, cors, 400, "invalid-media-type", "Unknown mediaType.", {
                validTypes: getMediaTypeNames(config),
            });
        }
        const mediaTypePrefix = normalizeMediaPrefix(mediaTypeConfig.prefix);
        if (requestedPrefix === null) {
            return { mediaType, prefix: mediaTypePrefix };
        }
        const prefix = normalizeRequestedListPrefix(requestedPrefix);
        if (!prefix || !isPrefixInside(prefix, mediaTypePrefix)) {
            return problem(request, cors, 400, "bad-key", "Prefix is outside this media type.");
        }
        return { mediaType, prefix };
    }
    if (requestedPrefix === null) {
        return problem(request, cors, 400, "bad-request", "List requires mediaType or a configured prefix.");
    }
    const prefix = normalizeRequestedListPrefix(requestedPrefix);
    if (!prefix) {
        return problem(request, cors, 400, "bad-key", "Prefix is outside configured media prefixes.");
    }
    const resolvedMediaType = mediaTypeForKey(config, prefix);
    if (!resolvedMediaType) {
        return problem(request, cors, 400, "bad-key", "Prefix is outside configured media prefixes.");
    }
    return { mediaType: resolvedMediaType, prefix };
}
function groupDeleteKeysByBucket(config, keys, mediaTypes) {
    const groups = new Map();
    for (let index = 0; index < keys.length; index += 1) {
        const mediaType = mediaTypes[index];
        const bucket = getBucketConfig(config, mediaType);
        if (!bucket)
            return null;
        const groupKey = getBucketClientCacheKey(bucket);
        const existing = groups.get(groupKey);
        if (existing) {
            existing.keys.push(keys[index]);
        }
        else {
            groups.set(groupKey, { bucket, keys: [keys[index]] });
        }
    }
    return [...groups.values()];
}
function normalizeRequestedListPrefix(prefix) {
    const trimmed = prefix.trim();
    if (!trimmed || trimmed.startsWith("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
        return null;
    }
    const normalized = normalizeMediaPrefix(trimmed);
    return normalized && isSafeObjectKey(normalized) ? normalized : null;
}
function isPrefixInside(prefix, mediaTypePrefix) {
    return prefix === mediaTypePrefix || prefix.startsWith(`${mediaTypePrefix}/`);
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function getReadyConfig(request, config, cors) {
    const validation = validateMediaConfig(config);
    if (!validation.valid) {
        return problem(request, cors, 503, "media-disabled", "Media storage is not configured. Set the missing S3/R2 config values to enable uploads, listing, and signed URLs.", { missing: validation.missing, details: validation.errors });
    }
    return { config };
}
async function authorize(request, options) {
    if (!options.authorize)
        return null;
    const auth = await options.authorize(request);
    if (!auth) {
        return problem(request, options.cors, 401, "unauthorized", "Missing or invalid credentials.");
    }
    return auth;
}
function normalizePolicyDecision(result) {
    if (result === undefined || result === null)
        return { allowed: true };
    if (typeof result === "boolean")
        return { allowed: result };
    return result;
}
function resolveKeys(config, keys, path) {
    const resolvedKeys = [];
    const mediaTypes = [];
    for (const key of keys) {
        const resolved = resolveRequestedKey(config, key, path);
        if (!resolved)
            return null;
        resolvedKeys.push(resolved.key);
        mediaTypes.push(resolved.mediaType);
    }
    return { keys: resolvedKeys, mediaTypes };
}
async function settleWithConcurrency(items, limit, run) {
    const results = [];
    for (let start = 0; start < items.length; start += limit) {
        results.push(...(await Promise.allSettled(items.slice(start, start + limit).map(run))));
    }
    return results;
}
function json(request, cors, status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...(cors?.getHeaders?.(request) ?? {}) },
    });
}
function problem(request, cors, status, code, message, extra) {
    return json(request, cors, status, { code, message, ...(extra ?? {}) });
}
/**
 * `process` does not exist on Cloudflare Workers without the `nodejs_compat`
 * flag, so reading `process.env` directly would throw `ReferenceError` there.
 * An undefined NODE_ENV means "log the failure and include error details",
 * matching non-production Node behavior.
 */
function getNodeEnv() {
    return typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
}
function storageFailure(request, cors, message, error) {
    const nodeEnv = getNodeEnv();
    if (nodeEnv !== "test") {
        console.error(message, error);
    }
    return problem(request, cors, 500, "storage-failure", message, {
        ...(nodeEnv !== "production"
            ? { details: error instanceof Error ? error.message : String(error) }
            : {}),
    });
}
