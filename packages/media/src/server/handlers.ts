import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import {
  getBucketConfig,
  getMediaTypeConfig,
  getMediaTypeNames,
  isAllowedContentType,
  validateMediaConfig,
  type MediaBucketConfig,
  type MediaConfig,
} from "../config";
import { buildMediaKey, resolveRequestedKey } from "../keys";

type MaybePromise<T> = T | Promise<T>;

export interface MediaPolicyDecision {
  allowed: boolean;
  reason?: string;
  code?: string;
  allowCustomFilename?: boolean;
}

export type MediaPolicyResult = boolean | MediaPolicyDecision | undefined | null;

export interface MediaPolicyCallbacks<TAuth> {
  canUpload?: (context: {
    request: Request;
    auth: TAuth;
    mediaType: string;
    contentType: string;
    size?: number;
    customFilename?: string;
    metadata?: unknown;
  }) => MaybePromise<MediaPolicyResult>;
  canRead?: (context: {
    request: Request;
    auth: TAuth;
    keys: string[];
    mediaTypes: string[];
  }) => MaybePromise<MediaPolicyResult>;
  canList?: (context: {
    request: Request;
    auth: TAuth;
    mediaType?: string;
    prefix?: string;
  }) => MaybePromise<MediaPolicyResult>;
  canDelete?: (context: {
    request: Request;
    auth: TAuth;
    keys: string[];
    mediaTypes: string[];
  }) => MaybePromise<MediaPolicyResult>;
}

export interface MediaEventCallbacks<TAuth> {
  onUploadSigned?: (context: {
    request: Request;
    auth: TAuth;
    key: string;
    mediaType: string;
    contentType: string;
    metadata?: unknown;
  }) => MaybePromise<void>;
  onDeleted?: (context: {
    request: Request;
    auth: TAuth;
    keys: string[];
  }) => MaybePromise<void>;
}

export interface MediaCorsCallbacks {
  getHeaders?: (request: Request) => Record<string, string>;
  getPreflightHeaders?: (request: Request) => Record<string, string>;
}

export interface CreateMediaHandlersOptions<TAuth = unknown> {
  config: MediaConfig | (() => MediaConfig);
  authorize?: (request: Request) => MaybePromise<TAuth | null | undefined>;
  policy?: MediaPolicyCallbacks<TAuth>;
  events?: MediaEventCallbacks<TAuth>;
  cors?: MediaCorsCallbacks;
  idFactory?: () => string;
}

export interface MediaHandlers {
  options: (request: Request) => Promise<Response>;
  getUploadUrl: (request: Request) => Promise<Response>;
  getSignedUrls: (request: Request) => Promise<Response>;
  list: (request: Request) => Promise<Response>;
  deleteOne: (request: Request) => Promise<Response>;
  deleteMany: (request: Request) => Promise<Response>;
}

interface UploadUrlRequestBody {
  mediaType?: unknown;
  contentType?: unknown;
  size?: unknown;
  customFilename?: unknown;
  metadata?: unknown;
}

const s3ClientCache = new Map<string, S3Client>();

export function resetMediaStorageForTests(): void {
  s3ClientCache.clear();
}

export function createMediaHandlers<TAuth = unknown>(
  options: CreateMediaHandlersOptions<TAuth>,
): MediaHandlers {
  const idFactory = options.idFactory ?? ulid;

  const getConfig = (): MediaConfig =>
    typeof options.config === "function" ? options.config() : options.config;

  async function optionsHandler(request: Request): Promise<Response> {
    return new Response(null, {
      status: 200,
      headers: options.cors?.getPreflightHeaders?.(request) ?? {},
    });
  }

  async function getUploadUrl(request: Request): Promise<Response> {
    const ready = getReadyConfig(request, getConfig(), options.cors);
    if (ready instanceof Response) return ready;
    const { config } = ready;

    const authOrResponse = await authorize(request, options);
    if (authOrResponse instanceof Response) return authOrResponse;
    const auth = authOrResponse;

    let body: UploadUrlRequestBody;
    try {
      body = await request.json();
    } catch {
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

    const customFilename =
      typeof body.customFilename === "string" && body.customFilename.trim() !== ""
        ? body.customFilename
        : undefined;

    const policy = normalizePolicyDecision(
      await options.policy?.canUpload?.({
        request,
        auth,
        mediaType: body.mediaType,
        contentType: body.contentType,
        size,
        customFilename,
        metadata: body.metadata,
      }),
    );
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
      const command = new PutObjectCommand({
        Bucket: bucket.bucket,
        Key: key,
        ContentType: body.contentType,
      });
      const uploadUrl = await getSignedUrl(getS3Client(bucket), command, { expiresIn });
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
    } catch (error) {
      return storageFailure(request, options.cors, "Failed to create upload URL.", error);
    }
  }

  async function getSignedUrls(request: Request): Promise<Response> {
    const ready = getReadyConfig(request, getConfig(), options.cors);
    if (ready instanceof Response) return ready;
    const { config } = ready;

    const authOrResponse = await authorize(request, options);
    if (authOrResponse instanceof Response) return authOrResponse;
    const auth = authOrResponse;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const keys = Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === "string" && key.trim() !== "")
      : [];
    const path = typeof body.path === "string" && body.path.trim() !== "" ? body.path : undefined;
    if (keys.length === 0) {
      return problem(request, options.cors, 400, "bad-request", "Missing or invalid keys.");
    }

    const resolved = resolveKeys(config, keys, path);
    if (!resolved) {
      return problem(request, options.cors, 400, "bad-key", "One or more keys are outside configured media prefixes.");
    }

    const policy = normalizePolicyDecision(
      await options.policy?.canRead?.({
        request,
        auth,
        keys: resolved.keys,
        mediaTypes: resolved.mediaTypes,
      }),
    );
    if (!policy.allowed) {
      return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "Read is not allowed.");
    }

    const urls: Record<string, string> = {};
    try {
      for (let index = 0; index < resolved.keys.length; index += 1) {
        const mediaType = resolved.mediaTypes[index]!;
        const key = resolved.keys[index]!;
        const bucket = getBucketConfig(config, mediaType);
        const mediaTypeConfig = getMediaTypeConfig(config, mediaType)!;
        if (!bucket) throw new Error(`Missing bucket for ${mediaType}`);
        const command = new GetObjectCommand({ Bucket: bucket.bucket, Key: key });
        urls[keys[index]!] = await getSignedUrl(getS3Client(bucket), command, {
          expiresIn: mediaTypeConfig.readExpiresInSeconds ?? 86400,
        });
      }
      return json(request, options.cors, 200, { urls });
    } catch (error) {
      return storageFailure(request, options.cors, "Failed to create signed URLs.", error);
    }
  }

  async function list(request: Request): Promise<Response> {
    const ready = getReadyConfig(request, getConfig(), options.cors);
    if (ready instanceof Response) return ready;
    const { config } = ready;

    const authOrResponse = await authorize(request, options);
    if (authOrResponse instanceof Response) return authOrResponse;
    const auth = authOrResponse;

    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || "";
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") || "100", 10), 1000);
    const mediaType = url.searchParams.get("mediaType") || undefined;

    let targetMediaType = mediaType;
    if (!targetMediaType && prefix) {
      const resolved = resolveKeys(config, ["__placeholder"], prefix);
      targetMediaType = resolved?.mediaTypes[0];
    }
    if (mediaType && !getMediaTypeConfig(config, mediaType)) {
      return problem(request, options.cors, 400, "invalid-media-type", "Unknown mediaType.", {
        validTypes: getMediaTypeNames(config),
      });
    }

    const policy = normalizePolicyDecision(
      await options.policy?.canList?.({ request, auth, mediaType: targetMediaType, prefix }),
    );
    if (!policy.allowed) {
      return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "List is not allowed.");
    }

    const mediaTypeForBucket = targetMediaType ?? getMediaTypeNames(config)[0];
    const bucket = mediaTypeForBucket ? getBucketConfig(config, mediaTypeForBucket) : null;
    if (!bucket) return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");

    try {
      const result = await getS3Client(bucket).send(
        new ListObjectsV2Command({
          Bucket: bucket.bucket,
          Prefix: prefix || undefined,
          MaxKeys: limit,
          ContinuationToken: cursor,
        }),
      );
      const items = (result.Contents ?? []).map((item) => ({
        key: item.Key ?? "",
        size: item.Size ?? 0,
        lastModified: item.LastModified?.toISOString() ?? "",
      })).filter((item) => item.key);
      return json(request, options.cors, 200, {
        items,
        totalCount: items.length,
        nextCursor: result.NextContinuationToken,
      });
    } catch (error) {
      return storageFailure(request, options.cors, "Failed to list media.", error);
    }
  }

  async function deleteOne(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return problem(request, options.cors, 400, "bad-request", "Missing key parameter.");
    }
    return deleteKeys(request, [key], false);
  }

  async function deleteMany(request: Request): Promise<Response> {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      return problem(request, options.cors, 400, "bad-request", "Missing or invalid keys array.");
    }
    if (body.keys.length > 1000) {
      return problem(request, options.cors, 400, "bad-request", "Maximum 1000 keys per request.");
    }
    const keys = body.keys.filter((key): key is string => typeof key === "string" && key.trim() !== "");
    if (keys.length !== body.keys.length) {
      return problem(request, options.cors, 400, "bad-request", "Keys must be non-empty strings.");
    }
    return deleteKeys(request, keys, true);
  }

  async function deleteKeys(
    request: Request,
    keys: string[],
    batch: boolean,
  ): Promise<Response> {
    const ready = getReadyConfig(request, getConfig(), options.cors);
    if (ready instanceof Response) return ready;
    const { config } = ready;

    const authOrResponse = await authorize(request, options);
    if (authOrResponse instanceof Response) return authOrResponse;
    const auth = authOrResponse;

    const resolved = resolveKeys(config, keys);
    if (!resolved) {
      return problem(request, options.cors, 400, "bad-key", "One or more keys are outside configured media prefixes.");
    }
    const policy = normalizePolicyDecision(
      await options.policy?.canDelete?.({
        request,
        auth,
        keys: resolved.keys,
        mediaTypes: resolved.mediaTypes,
      }),
    );
    if (!policy.allowed) {
      return problem(request, options.cors, 403, policy.code ?? "forbidden", policy.reason ?? "Delete is not allowed.");
    }

    const mediaType = resolved.mediaTypes[0]!;
    const bucket = getBucketConfig(config, mediaType);
    if (!bucket) return problem(request, options.cors, 503, "media-disabled", "Media storage is not configured.");

    try {
      if (!batch) {
        await getS3Client(bucket).send(
          new DeleteObjectCommand({ Bucket: bucket.bucket, Key: resolved.keys[0] }),
        );
        await options.events?.onDeleted?.({ request, auth, keys: resolved.keys });
        return json(request, options.cors, 200, { success: true, key: resolved.keys[0] });
      }

      const result = await getS3Client(bucket).send(
        new DeleteObjectsCommand({
          Bucket: bucket.bucket,
          Delete: {
            Objects: resolved.keys.map((key) => ({ Key: key })),
            Quiet: false,
          },
        }),
      );
      const deleted = result.Deleted?.map((item) => item.Key).filter((key): key is string => Boolean(key)) ?? [];
      await options.events?.onDeleted?.({ request, auth, keys: deleted });
      return json(request, options.cors, 200, {
        success: true,
        deleted,
        errors: result.Errors?.map((error) => ({ key: error.Key, message: error.Message })) ?? [],
      });
    } catch (error) {
      return storageFailure(
        request,
        options.cors,
        batch ? "Failed to delete files." : "Failed to delete file.",
        error,
      );
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

function getReadyConfig(
  request: Request,
  config: MediaConfig,
  cors?: MediaCorsCallbacks,
): { config: MediaConfig } | Response {
  const validation = validateMediaConfig(config);
  if (!validation.valid) {
    return problem(
      request,
      cors,
      503,
      "media-disabled",
      "Media storage is not configured. Set the missing S3/R2 config values to enable uploads, listing, and signed URLs.",
      { missing: validation.missing, details: validation.errors },
    );
  }
  return { config };
}

async function authorize<TAuth>(
  request: Request,
  options: CreateMediaHandlersOptions<TAuth>,
): Promise<TAuth | Response> {
  if (!options.authorize) return null as TAuth;
  const auth = await options.authorize(request);
  if (!auth) {
    return problem(request, options.cors, 401, "unauthorized", "Missing or invalid credentials.");
  }
  return auth;
}

function normalizePolicyDecision(result: MediaPolicyResult): MediaPolicyDecision {
  if (result === undefined || result === null) return { allowed: true };
  if (typeof result === "boolean") return { allowed: result };
  return result;
}

function resolveKeys(
  config: MediaConfig,
  keys: string[],
  path?: string,
): { keys: string[]; mediaTypes: string[] } | null {
  const resolvedKeys: string[] = [];
  const mediaTypes: string[] = [];
  for (const key of keys) {
    const resolved = resolveRequestedKey(config, key, path);
    if (!resolved) return null;
    resolvedKeys.push(resolved.key);
    mediaTypes.push(resolved.mediaType);
  }
  return { keys: resolvedKeys, mediaTypes };
}

function getS3Client(bucket: MediaBucketConfig): S3Client {
  const cacheKey = JSON.stringify({
    endpoint: bucket.endpoint,
    region: bucket.region,
    bucket: bucket.bucket,
    accessKeyId: bucket.credentials.accessKeyId,
  });
  const cached = s3ClientCache.get(cacheKey);
  if (cached) return cached;

  const config: S3ClientConfig = {
    region: bucket.region,
    endpoint: bucket.endpoint,
    credentials: {
      accessKeyId: bucket.credentials.accessKeyId!,
      secretAccessKey: bucket.credentials.secretAccessKey!,
    },
    forcePathStyle: bucket.forcePathStyle ?? bucket.provider === "r2",
  };
  const client = new S3Client(config);
  s3ClientCache.set(cacheKey, client);
  return client;
}

function json(
  request: Request,
  cors: MediaCorsCallbacks | undefined,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(cors?.getHeaders?.(request) ?? {}) },
  });
}

function problem(
  request: Request,
  cors: MediaCorsCallbacks | undefined,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return json(request, cors, status, { code, message, ...(extra ?? {}) });
}

function storageFailure(
  request: Request,
  cors: MediaCorsCallbacks | undefined,
  message: string,
  error: unknown,
): Response {
  if (process.env.NODE_ENV !== "test") {
    console.error(message, error);
  }
  return problem(request, cors, 500, "storage-failure", message, {
    ...(process.env.NODE_ENV !== "production"
      ? { details: error instanceof Error ? error.message : String(error) }
      : {}),
  });
}
