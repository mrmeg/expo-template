/**
 * FFmpeg worker asset contract.
 *
 * The web video-conversion flow (client/features/media/lib/videoConversion)
 * lazy-loads FFmpeg.wasm and proxies the worker through a same-origin URL to
 * satisfy the cross-origin worker-blob trick from GitHub issue #694.
 *
 * Two runtimes have to agree on this contract:
 *   - metro.config.js serves the worker during `expo start` (dev)
 *   - server/index.ts serves the worker from the static Express build (prod)
 *
 * Drift between those two sites has already caused one regression where the
 * worker path pointed at a folder that no longer existed, so the Express
 * route was silently never registered. Keep the path constant and lookup
 * logic here, in one CommonJS file that both runtimes can require.
 */

const fs = require("fs");
const path = require("path");

/**
 * URL the client fetches to load the worker. Keep in sync with
 * `FFMPEG_WORKER_URL` in
 * `client/features/media/lib/videoConversion/config.ts`.
 */
const FFMPEG_WORKER_URL = "/_expo/static/js/web/ffmpeg-worker.js";

/**
 * Path to the worker file, relative to the repo root. The worker lives
 * alongside its consumer in the feature folder.
 */
const FFMPEG_WORKER_RELATIVE_PATH =
  "client/features/media/lib/videoConversion/ffmpeg-worker.js";

/**
 * Resolve the absolute worker path against a caller-supplied base directory.
 * Metro passes `__dirname`; the Express server passes `process.cwd()`.
 */
function resolveFfmpegWorkerPath(baseDir) {
  return path.join(baseDir, FFMPEG_WORKER_RELATIVE_PATH);
}

/**
 * Read the worker contents if the file exists. Returns `null` when it does
 * not, so callers can skip registering the route (keeping FFmpeg optional).
 *
 * Any unexpected read error propagates — that indicates the file exists but
 * is unreadable, which is a real deployment problem worth surfacing.
 */
function loadFfmpegWorker(baseDir) {
  const absolutePath = resolveFfmpegWorkerPath(baseDir);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return {
    absolutePath,
    contents: fs.readFileSync(absolutePath, "utf8"),
  };
}

module.exports = {
  FFMPEG_WORKER_URL,
  FFMPEG_WORKER_RELATIVE_PATH,
  resolveFfmpegWorkerPath,
  loadFfmpegWorker,
};
