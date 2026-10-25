import { act, renderHook } from "@testing-library/react-native";
import React from "react";
import type { MediaUploadOptions, MediaUploadResult } from "../../client";
import type { BackfillVideoThumbnailResult } from "../backfill";
import {
  useVideoThumbnailBackfill,
  type UseVideoThumbnailBackfillOptions,
} from "../useVideoThumbnailBackfill";
import { deferred, flush, type Deferred } from "./helpers";

type Extract = NonNullable<UseVideoThumbnailBackfillOptions["extract"]>;
type Frame = Awaited<ReturnType<Extract>>;

const input = (id: string) => ({
  videoKey: `videos/${id}.mov`,
  videoUrl: `https://bucket.example/videos/${id}.mov`,
});

/** Extractions wait on promises the test settles, so ordering is explicit. */
function setup(overrides: Partial<UseVideoThumbnailBackfillOptions<string>> = {}) {
  const extractions: { url: string; result: Deferred<Frame> }[] = [];
  const uploads: MediaUploadOptions<string>[] = [];

  const options = (): UseVideoThumbnailBackfillOptions<string> => ({
    thumbnailMediaType: "thumbnails",
    extract: (url) => {
      const result = deferred<Frame>();
      extractions.push({ url, result });
      return result.promise;
    },
    upload: async (uploadOptions): Promise<MediaUploadResult> => {
      uploads.push(uploadOptions);
      return {
        key: `thumbnails/${uploadOptions.customFilename}.jpg`,
        uploadUrl: "https://bucket.example/u",
        expiresAt: "2030-01-01T00:00:00Z",
      };
    },
    ...overrides,
  });

  return { extractions, uploads, options };
}

const frame: Frame = { uri: "file:///frame.jpg", width: 1, height: 1 };

describe("useVideoThumbnailBackfill", () => {
  it("is idle until run is called, and extracts nothing by itself", async () => {
    const t = setup();
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      await flush();
    });

    expect(result.current.running).toBe(false);
    expect(result.current.progress).toEqual({ done: 0, failed: 0, total: 0 });
    expect(result.current.results).toEqual([]);
    expect(t.extractions).toHaveLength(0);
  });

  it("uploads each video, tracks progress, and settles once", async () => {
    const onSettled = jest.fn();
    const t = setup({ onSettled });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A"), input("B")]);
    });
    expect(result.current.running).toBe(true);
    expect(result.current.progress).toEqual({ done: 0, failed: 0, total: 2 });

    // Concurrency defaults to 1: only the first video is being read.
    expect(t.extractions.map((e) => e.url)).toEqual([input("A").videoUrl]);
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });
    expect(result.current.progress).toEqual({ done: 1, failed: 0, total: 2 });
    expect(onSettled).not.toHaveBeenCalled();

    await act(async () => {
      t.extractions[1]!.result.resolve(null);
      await flush();
    });

    expect(result.current.running).toBe(false);
    expect(result.current.progress).toEqual({ done: 1, failed: 1, total: 2 });
    expect(result.current.results.map((r) => [r.videoKey, r.status])).toEqual([
      ["videos/A.mov", "uploaded"],
      ["videos/B.mov", "failed"],
    ]);
    expect(t.uploads.map((u) => u.customFilename)).toEqual(["A"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0]![0]).toEqual(result.current.results);
  });

  it("runs up to `concurrency` videos at once", async () => {
    const t = setup({ concurrency: 2 });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A"), input("B"), input("C")]);
    });
    expect(t.extractions).toHaveLength(2);

    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });
    expect(t.extractions).toHaveLength(3);
  });

  it("ignores inputs whose video is already running, and repeats within one call", async () => {
    const t = setup({ concurrency: 3 });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A"), input("A"), input("B")]);
    });
    await act(async () => {
      result.current.run([input("A"), input("B"), input("C")]);
    });

    expect(result.current.progress.total).toBe(3);
    // A and B run now; C is a second batch and starts when the first settles.
    expect(t.extractions.map((e) => e.url)).toEqual([input("A").videoUrl, input("B").videoUrl]);

    await act(async () => {
      for (const extraction of t.extractions.slice()) extraction.result.resolve(frame);
      await flush();
    });
    expect(t.extractions.map((e) => e.url)).toContain(input("C").videoUrl);
    await act(async () => {
      t.extractions[2]!.result.resolve(frame);
      await flush();
    });
    expect(result.current.running).toBe(false);

    // Once finished, a video can run again.
    await act(async () => {
      result.current.run([input("A")]);
    });
    expect(t.extractions).toHaveLength(4);
  });

  it("fires onSettled once per run batch, and keeps concurrency across batches", async () => {
    const onSettled = jest.fn();
    const t = setup({ onSettled });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A")]);
      result.current.run([input("B")]);
    });
    expect(result.current.progress.total).toBe(2);
    expect(t.extractions).toHaveLength(1);

    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0]![0]).toHaveLength(1);
    expect(t.extractions).toHaveLength(2);

    await act(async () => {
      t.extractions[1]!.result.resolve(frame);
      await flush();
    });
    expect(onSettled).toHaveBeenCalledTimes(2);
    const keys = onSettled.mock.calls.map(([batch]) =>
      (batch as BackfillVideoThumbnailResult[]).map((r) => r.videoKey),
    );
    expect(keys).toEqual([["videos/A.mov"], ["videos/B.mov"]]);
  });

  it("reports an upload failure as failed without rejecting", async () => {
    const t = setup({
      upload: async () => {
        throw new Error("403");
      },
    });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A")]);
    });
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });

    expect(result.current.progress).toEqual({ done: 0, failed: 1, total: 1 });
    expect(result.current.results[0]).toMatchObject({ status: "failed", videoKey: "videos/A.mov" });
  });

  it("reads the latest options as each video starts", async () => {
    const first = jest.fn(async () => ({ key: "k1", uploadUrl: "u", expiresAt: "e" }));
    const second = jest.fn(async () => ({ key: "k2", uploadUrl: "u", expiresAt: "e" }));
    const t = setup();
    const { result, rerender } = await renderHook(
      ({ upload }: { upload: UseVideoThumbnailBackfillOptions<string>["upload"] }) =>
        useVideoThumbnailBackfill({ ...t.options(), upload }),
      { initialProps: { upload: first } },
    );

    await act(async () => {
      result.current.run([input("A"), input("B")]);
    });
    await rerender({ upload: second });
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });
    await act(async () => {
      t.extractions[1]!.result.resolve(frame);
      await flush();
    });

    // A started before the rerender, B after it.
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("sets no state and does not settle after unmount, and starts no more videos", async () => {
    const onSettled = jest.fn();
    const t = setup({ onSettled });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A"), input("B")]);
    });
    await unmount();
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });

    expect(t.extractions).toHaveLength(1);
    expect(onSettled).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("keeps working after StrictMode's mount, unmount, mount", async () => {
    const t = setup();
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>{children}</React.StrictMode>
      ),
    });

    await act(async () => {
      result.current.run([input("A")]);
    });
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });

    expect(result.current.progress).toEqual({ done: 1, failed: 0, total: 1 });
  });

  it("swallows an onSettled that throws", async () => {
    const t = setup({
      onSettled: () => {
        throw new Error("app bug");
      },
    });
    const { result } = await renderHook(() => useVideoThumbnailBackfill(t.options()));

    await act(async () => {
      result.current.run([input("A")]);
    });
    await act(async () => {
      t.extractions[0]!.result.resolve(frame);
      await flush();
    });

    expect(result.current.running).toBe(false);
  });
});
