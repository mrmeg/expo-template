#!/usr/bin/env node
/** Summarize production export bytes for the styling engine comparison. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

const [webDirArg = "dist/client", baseUrl, ...routes] = process.argv.slice(2);
const webDir = resolve(webDirArg);
if (!existsSync(webDir)) {
  throw new Error(`Missing web export: ${webDir}`);
}

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function bytesFor(file) {
  const contents = readFileSync(file);
  if (contents.length === 0) return { raw: 0, gzip: 0, brotli: 0 };
  return {
    raw: contents.length,
    gzip: existsSync(`${file}.gz`) ? statSync(`${file}.gz`).size : gzipSync(contents).length,
    brotli: existsSync(`${file}.br`) ? statSync(`${file}.br`).size : brotliCompressSync(contents).length,
  };
}

function add(a, b) {
  return {
    raw: a.raw + b.raw,
    gzip: a.gzip + b.gzip,
    brotli: a.brotli + b.brotli,
  };
}

const empty = () => ({ raw: 0, gzip: 0, brotli: 0 });
const total = { js: empty(), css: empty(), other: empty() };
const exported = filesIn(webDir).filter(
  (file) => !/\.(?:br|gz|map)$/.test(file),
);
for (const file of exported) {
  const kind = file.endsWith(".js") ? "js" : file.endsWith(".css") ? "css" : "other";
  total[kind] = add(total[kind], bytesFor(file));
}

const output = {
  webDir,
  fileCount: exported.length,
  web: total,
  routes: {},
};

if (baseUrl) {
  for (const route of routes.length ? routes : ["/"]) {
    const response = await fetch(new URL(route, baseUrl), {
      headers: {
        Accept: "text/html",
        ...(process.env.STYLING_BENCH_COOKIE
          ? { Cookie: process.env.STYLING_BENCH_COOKIE }
          : {}),
      },
    });
    const html = await response.text();
    const paths = new Set();
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/g)) {
      const url = new URL(match[1], baseUrl);
      if (url.origin !== new URL(baseUrl).origin) continue;
      const file = join(webDir, decodeURIComponent(url.pathname).replace(/^\//, ""));
      if (existsSync(file) && (file.endsWith(".js") || file.endsWith(".css"))) {
        paths.add(file);
      }
    }
    const assets = [...paths].sort();
    const linked = assets.reduce((sum, file) => add(sum, bytesFor(file)), empty());
    const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
      .reduce((sum, match) => sum + Buffer.byteLength(match[1]), 0);
    output.routes[route] = {
      status: response.status,
      htmlBytes: Buffer.byteLength(html),
      inlineCssBytes: inlineCss,
      linkedAssets: linked,
      linkedPaths: assets.map((file) => relative(webDir, file)),
    };
  }
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
