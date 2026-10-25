/**
 * The hook is a thin subscription over the runner, so these cover what only React
 * adds: renders follow the queue, inline options never go stale, StrictMode's
 * mid-mount unmount does not touch the queue, and an upload outlives its screen.
 */

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import type { MediaUploadOptions, MediaUploadResult } from "../../client";
import type { createMediaQueryHooks } from "../../react-query";
import type { ProcessAssetOptions, ProcessedUpload } from "../../processing/processAsset";
import { useUploadQueue } from "../useUploadQueue";
import type { UploadQueueOptions, UploadQueueSummary } from "../types";
import { ALLOWLIST, deferred, flush, makeAsset, makeProcessed, type Deferred } from "./helpers";

// Compile-time contract: the React Query upload mutation drops straight into `upload`.
type MutateAsync = ReturnType<
  ReturnType<typeof createMediaQueryHooks>["useMediaUpload"]
>["mutateAsync"];
export const mutationFitsUpload = (mutateAsync: MutateAsync): UploadQueueOptions["upload"] =>
  mutateAsync;

function setup(overrides: Partial<UploadQueueOptions<string>> = {}) {
  const processing: Deferred<ProcessedUpload>[] = [];
  const uploads: { options: MediaUploadOptions<string>; result: Deferred<MediaUploadResult> }[] = [];

  const options = (): UploadQueueOptions<string> => ({
    allowlist: ALLOWLIST,
    resolve: () => ({ mediaType: "uploads" }),
    processAsset: (_options: ProcessAssetOptions) => {
      const result = deferred<ProcessedUpload>();
      processing.push(result);
      return result.promise;
    },
    upload: (uploadOptions) => {
      const result = deferred<MediaUploadResult>();
      uploads.push({ options: uploadOptions, result });
      return result.promise;
    },
    ...overrides,
  });

  return { processing, uploads, options };
}

const stored = (key: string): MediaUploadResult => ({
  key,
  uploadUrl: `https://bucket.example/${key}`,
  expiresAt: "2030-01-01T00:00:00Z",
});

describe("useUploadQueue", () => {
  it("shows items immediately and follows them through to done", async () => {
    const t = setup();
    const { result } = await renderHook(() => useUploadQueue(t.options()));
    expect(result.current.items).toEqual([]);
    expect(result.current.isActive).toBe(false);

    await act(async () => {
      result.current.add([makeAsset("a"), makeAsset("b")]);
    });
    expect(result.current.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.current.counts).toEqual({
      queued: 0,
      processing: 2,
      uploading: 0,
      done: 0,
      failed: 0,
    });
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    expect(result.current.counts).toMatchObject({ processing: 1, uploading: 1 });

    await act(async () => {
      t.uploads[0].result.resolve(stored("uploads/a.jpg"));
      await flush();
    });
    expect(result.current.items[0]).toMatchObject({ status: "done", key: "uploads/a.jpg" });
    expect(result.current.counts.done).toBe(1);
    expect(result.current.isActive).toBe(true);
  });

  it("goes idle and reports the drain once", async () => {
    const t = setup();
    const summaries: UploadQueueSummary[] = [];
    const { result } = await renderHook(() =>
      useUploadQueue({ ...t.options(), onSettled: (summary) => summaries.push(summary) }),
    );

    await act(async () => {
      result.current.add([makeAsset("a")]);
    });
    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    await act(async () => {
      t.uploads[0].result.reject(new Error("offline"));
      await flush();
    });

    expect(result.current.isActive).toBe(false);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].failed.map((item) => item.id)).toEqual(["a"]);

    await act(async () => {
      result.current.retry("a");
      await flush();
    });
    expect(result.current.items[0].status).toBe("uploading");

    await act(async () => {
      t.uploads[1].result.resolve(stored("uploads/a.jpg"));
      await flush();
    });
    expect(summaries).toHaveLength(2);
    expect(summaries[1].uploaded.map((item) => item.id)).toEqual(["a"]);

    await act(async () => {
      result.current.clearFinished();
    });
    expect(result.current.items).toEqual([]);
  });

  it("uses the latest upload and callbacks without restarting", async () => {
    const t = setup();
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await renderHook(
      ({ onItemSettled }: { onItemSettled: () => void }) =>
        useUploadQueue({ ...t.options(), onItemSettled }),
      { initialProps: { onItemSettled: first } },
    );

    await act(async () => {
      result.current.add([makeAsset("a")]);
    });
    await rerender({ onItemSettled: second });
    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    await act(async () => {
      t.uploads[0].result.resolve(stored("uploads/a.jpg"));
      await flush();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(t.processing).toHaveLength(1);
  });

  it("returns stable action functions across renders", async () => {
    const t = setup();
    const { result, rerender } = await renderHook(() => useUploadQueue(t.options()));
    const before = result.current;

    await rerender({});

    expect(result.current.add).toBe(before.add);
    expect(result.current.retry).toBe(before.retry);
    expect(result.current.remove).toBe(before.remove);
    expect(result.current.clearFinished).toBe(before.clearFinished);
    expect(result.current.clear).toBe(before.clear);
  });

  it("keeps working through StrictMode's mount, unmount, mount", async () => {
    const t = setup();
    const { result } = await renderHook(() => useUploadQueue(t.options()), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>{children}</React.StrictMode>
      ),
    });

    await act(async () => {
      result.current.add([makeAsset("a")]);
    });
    expect(result.current.items[0].status).toBe("processing");

    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    expect(result.current.items[0].status).toBe("uploading");
  });

  it("keeps uploading after unmount, quietly, and still reports the drain", async () => {
    const t = setup();
    const onSettled = jest.fn();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, unmount } = await renderHook(() =>
      useUploadQueue({ ...t.options(), onSettled }),
    );

    await act(async () => {
      result.current.add([makeAsset("a")]);
    });
    await unmount();
    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    expect(t.uploads).toHaveLength(1);

    await act(async () => {
      t.uploads[0].result.resolve(stored("uploads/a.jpg"));
      await flush();
    });

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0][0].uploaded.map((item: { id: string }) => item.id)).toEqual(["a"]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("removes an in-flight item from items right away", async () => {
    const t = setup();
    const { result } = await renderHook(() => useUploadQueue(t.options()));
    await act(async () => {
      result.current.add([makeAsset("a")]);
    });

    await act(async () => {
      result.current.remove("a");
    });
    expect(result.current.items).toEqual([]);

    await act(async () => {
      t.processing[0].resolve(makeProcessed());
      await flush();
    });
    expect(result.current.items).toEqual([]);
    expect(t.uploads).toHaveLength(0);
  });
});
