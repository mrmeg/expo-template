import { AwsClient } from "aws4fetch";
const ERROR_BODY_EXCERPT_LENGTH = 300;
const clientCache = new Map();
export function resetMediaStorageForTests() {
    clientCache.clear();
}
export async function presignPutUrl(options) {
    const url = buildObjectUrl(options.bucket, options.key);
    url.searchParams.set("X-Amz-Expires", String(options.expiresIn));
    const signed = await getClient(options.bucket).sign(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": options.contentType },
        aws: { signQuery: true, allHeaders: true },
    });
    return signed.url;
}
export async function presignGetUrl(options) {
    const url = buildObjectUrl(options.bucket, options.key);
    url.searchParams.set("X-Amz-Expires", String(options.expiresIn));
    const signed = await getClient(options.bucket).sign(url.toString(), {
        method: "GET",
        aws: { signQuery: true },
    });
    return signed.url;
}
export async function listObjects(options) {
    const url = buildBucketUrl(options.bucket);
    url.searchParams.set("list-type", "2");
    if (options.prefix)
        url.searchParams.set("prefix", options.prefix);
    if (options.maxKeys !== undefined)
        url.searchParams.set("max-keys", String(options.maxKeys));
    if (options.continuationToken) {
        url.searchParams.set("continuation-token", options.continuationToken);
    }
    const response = await send(options.bucket, "GET", url);
    return parseListObjectsResult(await response.text());
}
export async function deleteObject(options) {
    await send(options.bucket, "DELETE", buildObjectUrl(options.bucket, options.key));
}
export function getBucketClientCacheKey(bucket) {
    return JSON.stringify({
        endpoint: bucket.endpoint,
        region: bucket.region,
        bucket: bucket.bucket,
        accessKeyId: bucket.credentials.accessKeyId,
    });
}
async function send(bucket, method, url) {
    const signed = await getClient(bucket).sign(url.toString(), { method });
    const response = await fetch(signed);
    if (!response.ok) {
        throw new Error(`S3 ${method} ${url.pathname} failed with ${response.status}: ${await readBodyExcerpt(response)}`);
    }
    return response;
}
async function readBodyExcerpt(response) {
    const body = await response.text().catch(() => "");
    return body.slice(0, ERROR_BODY_EXCERPT_LENGTH);
}
function getClient(bucket) {
    const cacheKey = getBucketClientCacheKey(bucket);
    const cached = clientCache.get(cacheKey);
    if (cached)
        return cached;
    const client = new AwsClient({
        accessKeyId: bucket.credentials.accessKeyId,
        secretAccessKey: bucket.credentials.secretAccessKey,
        service: "s3",
        region: bucket.region,
    });
    clientCache.set(cacheKey, client);
    return client;
}
function buildBucketUrl(bucket) {
    const endpoint = bucket.endpoint ?? `https://s3.${bucket.region}.amazonaws.com`;
    const base = new URL(endpoint);
    const basePath = base.pathname.replace(/\/+$/, "");
    const pathStyle = bucket.forcePathStyle ?? bucket.provider === "r2";
    return new URL(pathStyle
        ? `${base.protocol}//${base.host}${basePath}/${bucket.bucket}`
        : `${base.protocol}//${bucket.bucket}.${base.host}${basePath}`);
}
function buildObjectUrl(bucket, key) {
    const bucketUrl = buildBucketUrl(bucket).toString().replace(/\/+$/, "");
    return new URL(`${bucketUrl}/${encodeObjectKey(key)}`);
}
function encodeObjectKey(key) {
    return key.split("/").map(encodeURIComponent).join("/");
}
function parseListObjectsResult(xml) {
    const items = [];
    const contentsPattern = /<Contents>([\s\S]*?)<\/Contents>/g;
    let match = contentsPattern.exec(xml);
    while (match) {
        const entry = match[1];
        const key = extractTagValue(entry, "Key");
        if (key) {
            const size = Number.parseInt(extractTagValue(entry, "Size") ?? "", 10);
            items.push({
                key,
                size: Number.isFinite(size) ? size : 0,
                lastModified: normalizeLastModified(extractTagValue(entry, "LastModified")),
            });
        }
        match = contentsPattern.exec(xml);
    }
    return {
        items,
        nextContinuationToken: extractTagValue(xml, "NextContinuationToken") ?? undefined,
    };
}
function extractTagValue(xml, tag) {
    const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
    return match ? unescapeXml(match[1]) : null;
}
function unescapeXml(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}
function normalizeLastModified(value) {
    if (!value)
        return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
