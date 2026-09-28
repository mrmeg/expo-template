#!/usr/bin/env node
/**
 * Precompress the web export's hashed static assets.
 *
 * Writes a brotli (`<file>.br`, quality 11) and a gzip (`<file>.gz`, level 9)
 * sibling next to every compressible file under `<clientDir>/_expo/static`
 * and `<clientDir>/assets`, which `server/http/staticFiles.ts` serves per
 * `Accept-Encoding` — so the server never compresses those files at runtime.
 *
 * Runs after `expo export` in `bun run build` and `bun run build-web`:
 *
 *   node scripts/precompress.mjs [clientDir]    # default: dist/client
 *
 * Only the content-hashed directories are covered: a file there never changes
 * under the same name, so its siblings cannot go stale. Files under 1 KB,
 * already-compressed formats, and source maps are skipped, and a sibling that
 * would not be smaller than its source is not written.
 */

import { availableParallelism } from "node:os";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

// libuv sizes its pool on first use, which is after this line runs.
process.env.UV_THREADPOOL_SIZE ??= String(Math.min(Math.max(availableParallelism(), 4), 16));

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Hashed directories, relative to the client dir (the server's immutable paths). */
const HASHED_DIRS = ["_expo/static", "assets"];

/** Keep in step with `isCompressibleContentType` in `server/http/compression.ts`. */
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const BINARY_EXTENSIONS = new Set([".eot", ".ico", ".otf", ".ttf", ".wasm"]);

/** Matches `MIN_COMPRESSIBLE_BYTES` in `server/http/compression.ts`. */
const MIN_BYTES = 1024;

const SIBLINGS = [
  {
    suffix: ".br",
    compress: (source, text) =>
      brotliAsync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_MODE]: text ? constants.BROTLI_MODE_TEXT : constants.BROTLI_MODE_GENERIC,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.byteLength,
        },
      }),
  },
  {
    suffix: ".gz",
    compress: (source) => gzipAsync(source, { level: constants.Z_BEST_COMPRESSION }),
  },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() ? [full] : [];
    }),
  );
  return files.flat();
}

function kindOf(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (BINARY_EXTENSIONS.has(extension)) return "binary";
  return null;
}

/** Run `tasks` with at most `limit` in flight. */
async function runPool(tasks, limit) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function precompressFile(filePath) {
  const kind = kindOf(filePath);
  const { size } = await stat(filePath);
  if (!kind || size < MIN_BYTES) {
    return null;
  }

  const source = await readFile(filePath);
  const written = {};
  for (const { suffix, compress } of SIBLINGS) {
    const siblingPath = `${filePath}${suffix}`;
    const compressed = await compress(source, kind === "text");
    if (compressed.byteLength < source.byteLength) {
      await writeFile(siblingPath, compressed);
      written[suffix] = compressed.byteLength;
    } else {
      // A stale sibling from an earlier run must not outlive a no-gain result.
      await rm(siblingPath, { force: true });
    }
  }
  return { filePath, size, written };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const clientDir = path.resolve(process.argv[2] ?? "dist/client");
  const clientStat = await stat(clientDir).catch(() => null);
  if (!clientStat?.isDirectory()) {
    console.error(`precompress: ${clientDir} is not a directory. Run the web export first.`);
    process.exit(1);
  }

  const startedAt = Date.now();
  const files = (await Promise.all(HASHED_DIRS.map((dir) => walk(path.join(clientDir, dir)))))
    .flat()
    .filter((file) => !file.endsWith(".br") && !file.endsWith(".gz"));
  const threads = Number(process.env.UV_THREADPOOL_SIZE) || 4;
  const results = (await runPool(files.map((file) => () => precompressFile(file)), threads))
    .filter((result) => result && Object.keys(result.written).length > 0);

  const totals = results.reduce(
    (sum, { size, written }) => ({
      source: sum.source + size,
      br: sum.br + (written[".br"] ?? size),
      gz: sum.gz + (written[".gz"] ?? size),
    }),
    { source: 0, br: 0, gz: 0 },
  );
  const relative = path.relative(process.cwd(), clientDir);
  const shown = relative && !relative.startsWith("..") ? relative : clientDir;
  console.log(
    `precompress: ${results.length} files under ${shown} ` +
      `(${formatBytes(totals.source)} → br ${formatBytes(totals.br)}, gzip ${formatBytes(totals.gz)}) ` +
      `in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
}

main().catch((error) => {
  console.error("precompress failed:", error);
  process.exit(1);
});
