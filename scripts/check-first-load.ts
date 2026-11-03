#!/usr/bin/env bun
/**
 * First-load budget: the JS `/` makes every visitor download.
 *
 * `bundle-size` sums every chunk, so it cannot see code moving from a lazy chunk
 * into `__common`. This renders `/` from `dist/server`, reads the `<script src>`
 * set out of the HTML, and compares its brotli size to the baseline.
 *
 * Usage:
 *   bun run build && bun run first-load
 *   bun run first-load --update    # rewrite the baseline; commit the result
 */
import fs from "node:fs";
import path from "node:path";

export const THRESHOLD = 0.05;
const MIN_PRECOMPRESSED_BYTES = 1024;
const BASELINE_PATH = path.join(__dirname, "first-load-baseline.json");

/** Same-origin `<script src>` values, in document order, without duplicates. */
export function scriptSources(html: string): string[] {
  const sources = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  return [...new Set(sources.filter((src) => src.startsWith("/")))];
}

export type Chunk = { src: string; raw: number; brotli: number };

export function measureChunks(clientDir: string, sources: string[]): Chunk[] {
  return sources.map((src) => {
    const file = path.join(clientDir, src);
    const raw = fs.statSync(file).size;
    if (fs.existsSync(`${file}.br`)) {
      return { src, raw, brotli: fs.statSync(`${file}.br`).size };
    }
    // scripts/precompress.mjs skips files under 1 KB; those go out as is.
    if (raw >= MIN_PRECOMPRESSED_BYTES) {
      throw new Error(`No ${src}.br: run \`bun run build\`, which precompresses the export.`);
    }
    return { src, raw, brotli: raw };
  });
}

const kB = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;

async function main() {
  const root = process.cwd();
  const { createRequestHandler } = await import("expo-server/adapter/bun");
  const handler = createRequestHandler({ build: path.join(root, "dist/server") });
  const response = await handler(new Request("http://localhost/"));
  if (!response.ok) throw new Error(`Rendering / returned ${response.status}.`);

  const chunks = measureChunks(path.join(root, "dist/client"), scriptSources(await response.text()));
  if (chunks.length === 0) throw new Error("Rendering / produced no script tags.");
  const raw = chunks.reduce((sum, chunk) => sum + chunk.raw, 0);
  const brotli = chunks.reduce((sum, chunk) => sum + chunk.brotli, 0);

  for (const chunk of [...chunks].sort((a, b) => b.brotli - a.brotli)) {
    console.log(`${kB(chunk.brotli).padStart(10)} br ${kB(chunk.raw).padStart(10)} raw  ${path.basename(chunk.src)}`);
  }
  console.log(`First load of /: ${kB(brotli)} brotli, ${kB(raw)} raw, ${chunks.length} scripts`);

  if (process.argv.includes("--update")) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({ route: "/", brotliBytes: brotli, rawBytes: raw }, null, 2)}\n`);
    console.log("Baseline updated.");
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8")) as { brotliBytes: number };
  const growth = (brotli - baseline.brotliBytes) / baseline.brotliBytes;
  console.log(`Baseline: ${kB(baseline.brotliBytes)} brotli. Growth: ${(growth * 100).toFixed(1)}% (limit ${THRESHOLD * 100}%).`);
  if (growth > THRESHOLD) {
    console.error("First load exceeded its budget: find what moved into __common or entry (docs/bundle-analysis.md).");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
