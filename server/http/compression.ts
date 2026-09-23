/**
 * Response compression for the Bun server. Nothing here blocks the event
 * loop: all zlib work goes through the async, thread-pool-backed APIs.
 *
 * - Content negotiation (`negotiateEncodings`) honors `Accept-Encoding`
 *   q-values; brotli wins ties over gzip.
 * - `compressResponse` streams dynamic responses (SSR HTML, loader and API
 *   JSON) through a compressor chunk by chunk — reading ahead at most 1 KB
 *   to skip bodies too small to be worth it, never buffering the whole body —
 *   and flushes whenever the upstream pauses, so a streamed render still
 *   reaches the client progressively.
 * - `createStaticCompressor` is the bounded runtime fallback for static
 *   files that have no build-time `.br` / `.gz` sibling
 *   (`scripts/precompress.mjs`): size-capped input, capped concurrency, and a
 *   byte-capped LRU of results.
 */

import {
  ReadableStream as RuntimeReadableStream,
  TransformStream as RuntimeTransformStream,
} from "node:stream/web";
import { promisify } from "node:util";
import {
  brotliCompress,
  constants as zlibConstants,
  createBrotliCompress,
  createGzip,
  gzip,
  type BrotliCompress,
  type Gzip,
} from "node:zlib";

import { appendVary, withMutableHeaders } from "./headers";

export type ContentEncoding = "br" | "gzip";

/** Bytes a `Response` accepts as a body (never SharedArrayBuffer-backed). */
export type Bytes = Uint8Array<ArrayBuffer>;

/** View a zlib/fs `Buffer` as body bytes without copying; Node never backs those with shared memory. */
function asBytes(buffer: Uint8Array): Bytes {
  return new Uint8Array(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength);
}

/** Bodies smaller than this are not worth an encoding. */
export const MIN_COMPRESSIBLE_BYTES = 1024;

/** On-the-fly brotli quality: ~20 ms per MB, within a few percent of quality 11's ratio on text. */
export const RUNTIME_BROTLI_QUALITY = 5;
export const RUNTIME_GZIP_LEVEL = 6;

const SUPPORTED_ENCODINGS: readonly ContentEncoding[] = ["br", "gzip"];

// The runtime's own stream classes, which every `Response.body` is built
// from. A polyfill installed on the globals (Jest's environment has one)
// would produce streams the runtime's `pipeThrough` rejects.
const StreamReadable = RuntimeReadableStream as unknown as typeof ReadableStream;
const StreamTransform = RuntimeTransformStream as unknown as typeof TransformStream;

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * The encodings a client accepts, best first. Honors q-values (`q=0` rules
 * one out), `*`, and the legacy `x-gzip` alias; brotli wins ties.
 */
export function negotiateEncodings(acceptEncoding: string | null | undefined): ContentEncoding[] {
  if (!acceptEncoding) {
    return [];
  }

  const weights = new Map<string, number>();
  for (const part of acceptEncoding.split(",")) {
    const [rawCoding, ...params] = part.split(";");
    const coding = rawCoding.trim().toLowerCase();
    if (!coding) continue;

    let quality = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match) {
        const parsed = Number(match[1]);
        quality = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
      }
    }
    const name = coding === "x-gzip" ? "gzip" : coding;
    weights.set(name, Math.max(weights.get(name) ?? 0, quality));
  }

  const wildcard = weights.get("*");
  return SUPPORTED_ENCODINGS
    .map((encoding, preference) => ({
      encoding,
      preference,
      quality: weights.get(encoding) ?? wildcard ?? 0,
    }))
    .filter(({ quality }) => quality > 0)
    .sort((a, b) => b.quality - a.quality || a.preference - b.preference)
    .map(({ encoding }) => encoding);
}

const COMPRESSIBLE_TYPES = new Set([
  "application/javascript",
  "application/ecmascript",
  "application/x-javascript",
  "application/json",
  "application/xml",
  "application/wasm",
  "application/vnd.ms-fontobject",
  "application/x-font-ttf",
  "font/otf",
  "font/ttf",
  "image/bmp",
  "image/vnd.microsoft.icon",
  "image/x-icon",
]);

/** Text-like types whose bodies shrink under brotli/gzip. Already-compressed formats (images, woff2, video) do not. */
export function isCompressibleContentType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    return false;
  }
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "text/event-stream") {
    return false;
  }
  return (
    type.startsWith("text/") ||
    type.endsWith("+json") ||
    type.endsWith("+xml") ||
    COMPRESSIBLE_TYPES.has(type)
  );
}

function hasNoTransform(headers: Headers): boolean {
  return /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(headers.get("Cache-Control") ?? "");
}

type CompressionStreamOptions = {
  brotliQuality?: number;
  gzipLevel?: number;
};

type ZlibCompressor = BrotliCompress | Gzip;

function createZlibCompressor(encoding: ContentEncoding, options: CompressionStreamOptions): ZlibCompressor {
  return encoding === "br"
    ? createBrotliCompress({
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: options.brotliQuality ?? RUNTIME_BROTLI_QUALITY,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    })
    : createGzip({ level: options.gzipLevel ?? RUNTIME_GZIP_LEVEL });
}

const scheduleIdle: (callback: () => void) => void =
  typeof setImmediate === "function"
    ? (callback) => { setImmediate(callback); }
    : (callback) => { setTimeout(callback, 0); };

/**
 * A web `TransformStream` that compresses a byte stream as it flows.
 *
 * Chunks go into zlib as they arrive, without a flush each, so a burst of
 * small chunks (React streams HTML in ~2 KB pieces) compresses together. Once
 * the upstream goes quiet for a turn of the event loop, the compressor is
 * flushed (`Z_SYNC_FLUSH` / `BROTLI_OPERATION_FLUSH`) so everything written
 * so far reaches the client — a streamed render still arrives progressively.
 */
export function createCompressionStream(
  encoding: ContentEncoding,
  options: CompressionStreamOptions = {},
): TransformStream<Uint8Array, Bytes> {
  const compressor = createZlibCompressor(encoding, options);
  const flushKind = encoding === "br"
    ? zlibConstants.BROTLI_OPERATION_FLUSH
    : zlibConstants.Z_SYNC_FLUSH;
  let flushScheduled = false;
  let ended = false;

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    scheduleIdle(() => {
      flushScheduled = false;
      if (!ended && !compressor.destroyed) {
        compressor.flush(flushKind);
      }
    });
  };

  // `cancel` (run when the client goes away) is newer than the DOM lib's
  // Transformer type; a runtime without it just never calls it.
  const transformer: Transformer<Uint8Array, Bytes> & { cancel?: () => void } = {
    start(controller) {
      compressor.on("data", (chunk: Buffer) => {
        controller.enqueue(asBytes(chunk));
      });
      compressor.on("error", (error) => {
        controller.error(error);
      });
    },
    transform(chunk) {
      scheduleFlush();
      if (compressor.write(chunk)) {
        return;
      }
      // zlib's input buffer is full: hold the upstream until it drains.
      return new Promise<void>((resolve, reject) => {
        const onDrain = () => {
          compressor.off("error", onError);
          resolve();
        };
        const onError = (error: Error) => {
          compressor.off("drain", onDrain);
          reject(error);
        };
        compressor.once("drain", onDrain);
        compressor.once("error", onError);
      });
    },
    flush() {
      ended = true;
      return new Promise<void>((resolve, reject) => {
        compressor.once("end", resolve);
        compressor.once("error", reject);
        compressor.end();
      });
    },
    cancel() {
      ended = true;
      compressor.destroy();
    },
  };
  return new StreamTransform<Uint8Array, Bytes>(transformer);
}

export type CompressResponseOptions = CompressionStreamOptions & {
  minBytes?: number;
};

const PENDING = Symbol("pending");

/** `promise`'s result if it settles within this turn of the event loop, else `PENDING`. */
function settledThisTurn<T>(promise: Promise<T>): Promise<T | typeof PENDING> {
  return Promise.race([
    promise,
    new Promise<typeof PENDING>((resolve) => scheduleIdle(() => resolve(PENDING))),
  ]);
}

function concatBytes(chunks: Uint8Array[], byteLength: number): Bytes {
  const joined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

/**
 * Compress a dynamic response on its way out when the client accepts it and
 * it is worthwhile: a compressible content type, no `Content-Encoding` or
 * `Cache-Control: no-transform` already on it (encoded responses pass through
 * untouched), and at least `minBytes` of body. Adds `Vary: Accept-Encoding`
 * whenever the representation depends on the request's `Accept-Encoding`.
 *
 * A body without `Content-Length` (every `Response.json()`, every SSR
 * stream) is read ahead only until `minBytes` have arrived, the body has
 * ended, or the upstream goes quiet for a turn of the event loop — so a
 * small JSON answer goes out as is with its exact length (the same bytes
 * for every client, so no `Vary`), while a stream that pauses is
 * compressed without waiting for the rest of it.
 */
export async function compressResponse(
  request: Request,
  response: Response,
  options: CompressResponseOptions = {},
): Promise<Response> {
  const { headers } = response;
  if (
    !response.body ||
    response.status < 200 ||
    response.status === 204 ||
    response.status === 206 ||
    response.status === 304 ||
    headers.has("Content-Encoding") ||
    headers.has("Content-Range") ||
    hasNoTransform(headers) ||
    !isCompressibleContentType(headers.get("Content-Type"))
  ) {
    return response;
  }

  const minBytes = options.minBytes ?? MIN_COMPRESSIBLE_BYTES;
  const declaredLength = headers.get("Content-Length");
  if (declaredLength !== null && Number(declaredLength) < minBytes) {
    return response;
  }

  if (request.method === "HEAD") {
    // No body goes out, so there is nothing to encode or measure.
    const outgoing = withMutableHeaders(response);
    appendVary(outgoing.headers, "Accept-Encoding");
    return outgoing;
  }

  let source: ReadableStream<Uint8Array> = response.body;
  if (declaredLength === null) {
    const reader = response.body.getReader();
    const head: Uint8Array[] = [];
    let headBytes = 0;
    let ended = false;
    let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;

    while (headBytes < minBytes) {
      const read = reader.read();
      const result = await settledThisTurn(read);
      if (result === PENDING) {
        pendingRead = read;
        break;
      }
      if (result.done) {
        ended = true;
        break;
      }
      head.push(result.value);
      headBytes += result.value.byteLength;
    }

    if (ended && headBytes < minBytes) {
      // The whole body arrived and is too small to be worth an encoding.
      const smallHeaders = new Headers(headers);
      smallHeaders.set("Content-Length", String(headBytes));
      return new Response(concatBytes(head, headBytes), {
        status: response.status,
        statusText: response.statusText,
        headers: smallHeaders,
      });
    }

    source = new StreamReadable<Uint8Array>({
      start(controller) {
        for (const chunk of head) controller.enqueue(chunk);
        if (ended) controller.close();
      },
      async pull(controller) {
        const result = await (pendingRead ?? reader.read());
        pendingRead = null;
        if (result.done) controller.close();
        else controller.enqueue(result.value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
  }

  const encoding = negotiateEncodings(request.headers.get("Accept-Encoding"))[0];
  if (!encoding) {
    const identityHeaders = new Headers(headers);
    appendVary(identityHeaders, "Accept-Encoding");
    return new Response(source, {
      status: response.status,
      statusText: response.statusText,
      headers: identityHeaders,
    });
  }

  const compressedHeaders = new Headers(headers);
  compressedHeaders.delete("Content-Length");
  compressedHeaders.delete("Accept-Ranges");
  compressedHeaders.set("Content-Encoding", encoding);
  appendVary(compressedHeaders, "Accept-Encoding");
  const etag = compressedHeaders.get("ETag");
  if (etag && !etag.startsWith("W/")) {
    // The encoded bytes differ, so a strong validator no longer applies.
    compressedHeaders.set("ETag", `W/${etag}`);
  }

  return new Response(source.pipeThrough(createCompressionStream(encoding, options)), {
    status: response.status,
    statusText: response.statusText,
    headers: compressedHeaders,
  });
}

/** Compress a whole buffer off the event loop. */
export async function compressBuffer(
  source: Uint8Array,
  encoding: ContentEncoding,
  options: { brotliQuality?: number; gzipLevel?: number } = {},
): Promise<Bytes> {
  const compressed = encoding === "br"
    ? await brotliCompressAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: options.brotliQuality ?? RUNTIME_BROTLI_QUALITY,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: source.byteLength,
      },
    })
    : await gzipAsync(source, { level: options.gzipLevel ?? RUNTIME_GZIP_LEVEL });
  return asBytes(compressed);
}

export interface StaticCompressorOptions {
  /** Larger files are served uncompressed rather than compressed at runtime. Default 8 MiB. */
  maxFileBytes?: number;
  /** Total compressed bytes kept in memory. Default 32 MiB. */
  maxCacheBytes?: number;
  /** Cache entries kept, counting "no gain" results. Default 512. */
  maxCacheEntries?: number;
  /** Compressions allowed at once; beyond it a request is served uncompressed instead of queued. Default 2. */
  maxConcurrent?: number;
  brotliQuality?: number;
  gzipLevel?: number;
}

export interface StaticCompressor {
  /**
   * Encoded bytes for a static body, or null when the fallback declines —
   * too small or too large, compressions already at capacity, no size win,
   * or a failed read — in which case the caller serves it uncompressed.
   * `key` must change whenever the bytes do (path plus size and mtime).
   */
  compress(
    key: string,
    size: number,
    encoding: ContentEncoding,
    load: () => Promise<Uint8Array>,
  ): Promise<Bytes | null>;
  readonly stats: { cachedBytes: number; cachedEntries: number; inFlight: number };
}

/**
 * The runtime fallback for static files without a precompressed sibling:
 * compresses asynchronously, dedupes concurrent requests for the same file,
 * refuses work past its bounds instead of queueing it, and keeps results in
 * a byte-bounded LRU.
 */
export function createStaticCompressor(options: StaticCompressorOptions = {}): StaticCompressor {
  const maxFileBytes = options.maxFileBytes ?? 8 * 1024 * 1024;
  const maxCacheBytes = options.maxCacheBytes ?? 32 * 1024 * 1024;
  const maxCacheEntries = options.maxCacheEntries ?? 512;
  const maxConcurrent = options.maxConcurrent ?? 2;

  // Map order is recency order: hits are re-inserted at the back.
  const cache = new Map<string, Bytes | null>();
  const inFlight = new Map<string, Promise<Bytes | null>>();
  let cachedBytes = 0;

  function remember(key: string, value: Bytes | null): void {
    const cost = value?.byteLength ?? 0;
    if (cost > maxCacheBytes) return;
    cache.set(key, value);
    cachedBytes += cost;
    while (cachedBytes > maxCacheBytes || cache.size > maxCacheEntries) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cachedBytes -= cache.get(oldest.value)?.byteLength ?? 0;
      cache.delete(oldest.value);
    }
  }

  return {
    async compress(key, size, encoding, load) {
      if (size < MIN_COMPRESSIBLE_BYTES || size > maxFileBytes) {
        return null;
      }

      const cacheKey = `${encoding}:${key}`;
      if (cache.has(cacheKey)) {
        const hit = cache.get(cacheKey) ?? null;
        cache.delete(cacheKey);
        cache.set(cacheKey, hit);
        return hit;
      }

      const pending = inFlight.get(cacheKey);
      if (pending) {
        return pending;
      }
      if (inFlight.size >= maxConcurrent) {
        return null;
      }

      // Starts on the next microtask, so the entry is registered before any
      // outcome (even a synchronous throw from `load`) can clear it.
      const job = Promise.resolve()
        .then(async () => {
          const source = await load();
          const compressed = await compressBuffer(source, encoding, options);
          const result = compressed.byteLength < source.byteLength ? compressed : null;
          remember(cacheKey, result);
          return result;
        })
        .catch(() => null)
        .finally(() => {
          inFlight.delete(cacheKey);
        });
      inFlight.set(cacheKey, job);
      return job;
    },
    get stats() {
      return { cachedBytes, cachedEntries: cache.size, inFlight: inFlight.size };
    },
  };
}
