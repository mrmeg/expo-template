/**
 * FFmpeg worker runtime-safety tests.
 *
 * convertVideo lazy-loads the FFmpeg worker through a same-origin URL to
 * satisfy the cross-origin worker-blob trick from ffmpeg.wasm issue #694.
 * When the server returns the SSR HTML fallback instead of the worker (the
 * exact failure mode caused by the prior path mismatch), the worker fetch
 * must reject with a typed error callers can branch on, instead of silently
 * wrapping the HTML into a blob that hangs FFmpeg.load().
 *
 * The end-to-end conversion path itself requires a real browser (script-tag
 * loading, worker threads) so it is not exercised here. What we pin down
 * instead is the error contract that the caller in useMediaLibrary depends
 * on to swap the toast copy.
 */

import { FFmpegWorkerUnavailableError } from "../convert";

const WORKER_URL = "https://app.example.com/_expo/static/js/web/ffmpeg-worker.js";

describe("FFmpegWorkerUnavailableError", () => {
  it("is a real Error subclass with the expected name", () => {
    const err = new FFmpegWorkerUnavailableError(WORKER_URL);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FFmpegWorkerUnavailableError);
    expect(err.name).toBe("FFmpegWorkerUnavailableError");
  });

  it("preserves the offending URL and optional HTTP status", () => {
    const err = new FFmpegWorkerUnavailableError(WORKER_URL, 404);
    expect(err.url).toBe(WORKER_URL);
    expect(err.status).toBe(404);
  });

  it("uses a helpful default message that references the URL", () => {
    const err = new FFmpegWorkerUnavailableError(WORKER_URL);
    expect(err.message).toContain(WORKER_URL);
  });

  it("accepts a custom message for content-type mismatches", () => {
    const err = new FFmpegWorkerUnavailableError(
      WORKER_URL,
      200,
      "Expected JavaScript worker, got text/html"
    );
    expect(err.message).toBe("Expected JavaScript worker, got text/html");
    expect(err.status).toBe(200);
  });
});
