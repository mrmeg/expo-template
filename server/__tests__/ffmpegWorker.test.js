/**
 * FFmpeg worker asset contract regression tests.
 *
 * The web video-conversion path hinges on two runtimes (metro.config.js and
 * server/index.ts) serving the same worker file at the same URL. A previous
 * regression shipped with both files pointing at a path that had been
 * refactored away, so the route silently never registered and web conversion
 * broke in production. These assertions lock the path contract in place.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  FFMPEG_WORKER_URL,
  FFMPEG_WORKER_RELATIVE_PATH,
  resolveFfmpegWorkerPath,
  loadFfmpegWorker,
} = require("../ffmpegWorker");

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("server/ffmpegWorker", () => {
  it("keeps the documented URL contract that the client fetches", () => {
    expect(FFMPEG_WORKER_URL).toBe("/_expo/static/js/web/ffmpeg-worker.js");
  });

  it("matches the client-side FFMPEG_WORKER_URL constant", () => {
    const configSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "packages/media/src/processing/videoConversion/config.ts"
      ),
      "utf8"
    );
    expect(configSource).toContain(`"${FFMPEG_WORKER_URL}"`);
  });

  it("points at a worker file that actually exists in the repo", () => {
    const absolutePath = path.join(REPO_ROOT, FFMPEG_WORKER_RELATIVE_PATH);
    expect(fs.existsSync(absolutePath)).toBe(true);
  });

  it("resolves the worker path against a caller-supplied base dir", () => {
    expect(resolveFfmpegWorkerPath("/tmp/project")).toBe(
      path.join("/tmp/project", FFMPEG_WORKER_RELATIVE_PATH)
    );
  });

  it("loads the real worker contents from the repo root", () => {
    const asset = loadFfmpegWorker(REPO_ROOT);
    expect(asset).not.toBeNull();
    expect(asset.absolutePath).toBe(
      path.join(REPO_ROOT, FFMPEG_WORKER_RELATIVE_PATH)
    );
    expect(asset.contents.length).toBeGreaterThan(0);
  });

  it("returns null when the worker is missing so the route can stay unregistered", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "ffmpeg-worker-"));
    try {
      expect(loadFfmpegWorker(emptyDir)).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
