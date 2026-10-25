/**
 * `usePairedVideoList` is `pairVideoThumbnails` over two list queries. These pin
 * what the hook adds: both lists are requested through the shared list query
 * keys, `data` waits for both, an equal-but-new `pairing` object does not change
 * `data`, and a mutation's list invalidation refreshes it.
 */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MediaClient, MediaItem, MediaListOptions } from "../../client";
import { MediaError } from "../../errors";
import { createMediaQueryHooks } from "..";

const item = (key: string): MediaItem => ({ key, size: 1, lastModified: "2026-01-01T00:00:00.000Z" });

function createFakeClient(initial: Record<string, MediaItem[]>) {
  const lists: Record<string, MediaItem[]> = { ...initial };
  const failing = new Set<string>();

  const list = jest.fn(async (options: MediaListOptions = {}) => {
    // A forbidden error is not retried, so it surfaces at once.
    if (failing.has(options.mediaType ?? "")) {
      throw new MediaError({ kind: "forbidden", message: `${options.mediaType} list failed` });
    }
    const items = lists[options.mediaType ?? ""] ?? [];
    return { items: [...items], totalCount: items.length };
  });

  const client = {
    list,
    getSignedUrls: jest.fn(),
    getUploadUrl: jest.fn(),
    upload: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  } as unknown as MediaClient;

  return { client, list, lists, failing };
}

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  queryClient.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

type Hooks = ReturnType<typeof createMediaQueryHooks>;

function renderPaired(hooks: Hooks, extra: { limit?: number; enabled?: boolean } = {}) {
  return renderHook(
    ({ pairing }: { pairing: { thumbnailPrefix: string; extension?: string } }) =>
      hooks.usePairedVideoList({
        videoMediaType: "videos",
        thumbnailMediaType: "thumbnails",
        pairing,
        ...extra,
      }),
    { initialProps: { pairing: { thumbnailPrefix: "thumbnails" } }, wrapper },
  );
}

describe("usePairedVideoList", () => {
  it("pairs listed videos with their thumbnails and reports orphans", async () => {
    const fake = createFakeClient({
      videos: [item("videos/A.mov"), item("videos/B.mov")],
      thumbnails: [item("thumbnails/A.jpg"), item("thumbnails/Z.jpg")],
    });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data!;
    expect(data.videos).toEqual([
      { video: item("videos/A.mov"), thumbnailKey: "thumbnails/A.jpg", thumbnail: item("thumbnails/A.jpg") },
      { video: item("videos/B.mov"), thumbnailKey: "thumbnails/B.jpg" },
    ]);
    expect(data.orphanThumbnails).toEqual([item("thumbnails/Z.jpg")]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fake.list).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "videos", limit: 100 }));
    expect(fake.list).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "thumbnails", limit: 100 }));
  });

  it("passes limit through to both lists", async () => {
    const fake = createFakeClient({ videos: [], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks, { limit: 500 });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(fake.list).toHaveBeenCalledTimes(2);
    for (const [options] of fake.list.mock.calls) expect(options).toMatchObject({ limit: 500 });
  });

  it("keeps data referentially stable across rerenders and an equal inline pairing", async () => {
    const fake = createFakeClient({ videos: [item("videos/A.mov")], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderPaired(hooks);
    await waitFor(() => expect(result.current.data).toBeDefined());
    const first = result.current.data;

    await rerender({ pairing: { thumbnailPrefix: "thumbnails" } });
    await rerender({ pairing: { thumbnailPrefix: "thumbnails" } });

    expect(result.current.data).toBe(first);
  });

  it("recomputes when the pairing's meaning changes", async () => {
    const fake = createFakeClient({
      videos: [item("videos/A.mov")],
      thumbnails: [item("thumbnails/A.png")],
    });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderPaired(hooks);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.videos[0]!.thumbnail).toBeUndefined();

    await rerender({ pairing: { thumbnailPrefix: "thumbnails", extension: "png" } });

    expect(result.current.data!.videos[0]!.thumbnail).toEqual(item("thumbnails/A.png"));
    expect(result.current.data!.orphanThumbnails).toEqual([]);
  });

  it("refreshes when the shared list queries are invalidated", async () => {
    const fake = createFakeClient({ videos: [item("videos/A.mov")], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);
    await waitFor(() => expect(result.current.data).toBeDefined());
    const before = result.current.data;

    fake.lists.thumbnails = [item("thumbnails/A.jpg")];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["media", "list"] });
    });

    await waitFor(() => expect(result.current.data!.videos[0]!.thumbnail).toBeDefined());
    expect(result.current.data).not.toBe(before);
  });

  it("uses the same query keys as useMediaList", async () => {
    const fake = createFakeClient({ videos: [item("videos/A.mov")], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(
      queryClient.getQueryData(hooks.queryKeys.list({ prefix: "", mediaType: "videos", limit: 100 })),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(hooks.queryKeys.list({ prefix: "", mediaType: "thumbnails", limit: 100 })),
    ).toBeDefined();
  });

  it("still shows the videos when the thumbnail list fails, and reports it apart", async () => {
    const fake = createFakeClient({ videos: [item("videos/A.mov")], thumbnails: [] });
    fake.failing.add("thumbnails");
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);

    await waitFor(() => expect(result.current.thumbnailsError).toBeInstanceOf(MediaError));
    expect(String(result.current.thumbnailsError)).toContain("thumbnails list failed");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.videos).toEqual([
      { video: item("videos/A.mov"), thumbnailKey: "thumbnails/A.jpg" },
    ]);
  });

  it("leaves data undefined and reports the error when the video list fails", async () => {
    const fake = createFakeClient({ videos: [item("videos/A.mov")], thumbnails: [] });
    fake.failing.add("videos");
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);

    await waitFor(() => expect(result.current.error).toBeInstanceOf(MediaError));
    expect(result.current.data).toBeUndefined();
    expect(result.current.thumbnailsError).toBeNull();
  });

  it("refetches both lists", async () => {
    const fake = createFakeClient({ videos: [], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(fake.list).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fake.list).toHaveBeenCalledTimes(4);
  });

  it("does not fetch while disabled", async () => {
    const fake = createFakeClient({ videos: [], thumbnails: [] });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderPaired(hooks, { enabled: false });

    expect(result.current.data).toBeUndefined();
    expect(fake.list).not.toHaveBeenCalled();
  });
});
