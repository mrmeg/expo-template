/**
 * Production entry: `bun run start` (after `bun run build`).
 *
 * Mounts the web export — `dist/server` through Expo Server's Bun adapter,
 * `dist/client` as statics — behind the request handler in
 * `server/http/createHandler.ts`, which owns CORS, rate limits, compression,
 * static caching, and security headers. Everything testable lives there;
 * this file only wires paths and the port.
 */

import path from "node:path";
import { createRequestHandler } from "expo-server/adapter/bun";

import { FFMPEG_WORKER_URL, loadFfmpegWorker } from "./server/ffmpegWorker.js";
import { createHandler, type PeerInfo } from "./server/http/createHandler";

declare const Bun: {
  serve(options: {
    port: number;
    fetch(request: Request, server: PeerInfo): Response | Promise<Response>;
  }): unknown;
};

const root = process.cwd();
const ffmpegWorker = loadFfmpegWorker(root) as { contents: string } | null;

const expoHandler = createRequestHandler({ build: path.join(root, "dist/server") });

const handler = createHandler({
  clientDir: path.join(root, "dist/client"),
  expoHandler,
  ffmpegWorker: ffmpegWorker ? { url: FFMPEG_WORKER_URL, contents: ffmpegWorker.contents } : null,
});

const port = Number(process.env.PORT || 3000);

Bun.serve({ port, fetch: handler });

console.log(`Bun server listening on port ${port}`);

// The first render loads and parses the server bundle, which otherwise costs the
// first visitor after every deploy several hundred milliseconds. Straight to the
// Expo handler, so it stays out of the access log and the rate limiters.
void Promise.resolve(expoHandler(new Request(`http://127.0.0.1:${port}/`)))
  .then((response) => response.body?.cancel())
  .catch((error) => console.error("SSR warmup failed:", error));
