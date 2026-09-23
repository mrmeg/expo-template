/**
 * Static file serving from the web export's `dist/client`.
 *
 * Hashed paths (`/_expo/static/`, `/assets/`) are cached for a year as
 * immutable; everything else for an hour. For compressible files the
 * response varies on `Accept-Encoding`:
 *
 * 1. A hashed file with a build-time sibling (`<file>.br` / `<file>.gz`,
 *    written by `scripts/precompress.mjs`) is answered from the sibling —
 *    `Content-Encoding` set, `Content-Length` the sibling's size.
 * 2. Otherwise the bounded runtime compressor (`createStaticCompressor`)
 *    encodes it off the event loop, once, and caches the result.
 * 3. Otherwise — the client wants no encoding, or the fallback declines —
 *    the file goes out as is.
 */

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  isCompressibleContentType,
  MIN_COMPRESSIBLE_BYTES,
  negotiateEncodings,
  type ContentEncoding,
  type StaticCompressor,
} from "./compression";
import { appendVary } from "./headers";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const SHORT_CACHE_CONTROL = "public, max-age=3600";

/** File suffix of each build-time precompressed sibling. */
export const PRECOMPRESSED_SUFFIX: Record<ContentEncoding, string> = {
  br: ".br",
  gzip: ".gz",
};

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".cjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".eot": "application/vnd.ms-fontobject",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

type BunRuntime = { file(filePath: string): Blob & { type: string } };

function bunRuntime(): BunRuntime | undefined {
  return (globalThis as { Bun?: BunRuntime }).Bun;
}

export function contentTypeFor(filePath: string): string {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    bunRuntime()?.file(filePath).type ||
    "application/octet-stream"
  );
}

/** Content-hashed paths, safe to cache forever. */
export function isImmutableStaticPath(pathname: string): boolean {
  return pathname.startsWith("/_expo/static/") || pathname.startsWith("/assets/");
}

export function cacheControlFor(pathname: string): string {
  return isImmutableStaticPath(pathname) ? IMMUTABLE_CACHE_CONTROL : SHORT_CACHE_CONTROL;
}

/**
 * A response body streaming `filePath`: `Bun.file` under Bun (sendfile),
 * a Node read stream elsewhere (tests).
 */
export function fileBody(filePath: string): BodyInit {
  const bun = bunRuntime();
  if (bun) {
    return bun.file(filePath);
  }
  return Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Files under `clientDir` a pathname may name, most specific first: the file
 * itself, then `<path>.html` for extensionless paths, `index.html` for
 * directories. Null for an undecodable path.
 */
function staticPathCandidates(clientDir: string, pathname: string): string[] | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) {
    return null;
  }

  const normalized = path.posix.normalize(`/${decoded}`);
  const relative = normalized.replace(/^\/+/, "");
  const candidates = new Set<string>();

  if (!relative || normalized.endsWith("/")) {
    candidates.add(path.posix.join(relative, "index.html"));
  } else {
    candidates.add(relative);
    if (!path.posix.extname(relative)) {
      candidates.add(`${relative}.html`);
    }
  }

  return Array.from(candidates).flatMap((candidate) => {
    const resolved = path.resolve(clientDir, candidate);
    return resolved === clientDir || resolved.startsWith(`${clientDir}${path.sep}`) ? [resolved] : [];
  });
}

async function fileStat(filePath: string) {
  const found = await stat(filePath).catch(() => null);
  return found?.isFile() ? found : null;
}

export interface StaticFileServer {
  /** The response for a static file, a 400 for an undecodable path, or null when no file matches. */
  serve(request: Request, pathname: string): Promise<Response | null>;
}

export function createStaticFileServer(options: {
  clientDir: string;
  compressor: StaticCompressor;
}): StaticFileServer {
  const clientDir = path.resolve(options.clientDir);
  const { compressor } = options;

  return {
    async serve(request, pathname) {
      const candidates = staticPathCandidates(clientDir, pathname);
      if (!candidates) {
        return new Response("Bad Request", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const stats = await Promise.all(candidates.map((candidate) => fileStat(candidate)));
      const index = stats.findIndex(Boolean);
      const filePath = candidates[index];
      const found = stats[index];
      if (!filePath || !found) {
        return null;
      }

      const contentType = contentTypeFor(filePath);
      const headers = new Headers({
        "Cache-Control": cacheControlFor(pathname),
        "Content-Type": contentType,
        "Last-Modified": found.mtime.toUTCString(),
      });
      const isHead = request.method === "HEAD";

      if (isCompressibleContentType(contentType) && found.size >= MIN_COMPRESSIBLE_BYTES) {
        appendVary(headers, "Accept-Encoding");
        const accepted = negotiateEncodings(request.headers.get("Accept-Encoding"));

        if (isImmutableStaticPath(pathname)) {
          for (const encoding of accepted) {
            const siblingPath = `${filePath}${PRECOMPRESSED_SUFFIX[encoding]}`;
            const sibling = await fileStat(siblingPath);
            if (sibling) {
              headers.set("Content-Encoding", encoding);
              headers.set("Content-Length", String(sibling.size));
              // Bun names a large `Bun.file` body in Content-Disposition,
              // which here would be the `.br`/`.gz` sibling's name.
              headers.set("Content-Disposition", "inline");
              return new Response(isHead ? null : fileBody(siblingPath), { headers });
            }
          }
        }

        const [preferred] = accepted;
        if (preferred) {
          const encoded = await compressor.compress(
            `${filePath}:${found.size}:${found.mtimeMs}`,
            found.size,
            preferred,
            () => readFile(filePath),
          );
          if (encoded) {
            headers.set("Content-Encoding", preferred);
            headers.set("Content-Length", String(encoded.byteLength));
            return new Response(isHead ? null : encoded, { headers });
          }
        }
      }

      headers.set("Content-Length", String(found.size));
      return new Response(isHead ? null : fileBody(filePath), { headers });
    },
  };
}
