/**
 * `useSignedMediaUrls` caches signed URLs per object key.
 *
 * The query key is the whole key list, so every upload or delete — which
 * changes the list — used to start a fresh query that re-signed every key. A
 * re-signed URL is a new URL (`X-Amz-Date` and the signature change), so every
 * image downloaded again. These pin the fix: a changed list signs only the keys
 * without a fresh URL, `staleTime` follows the URLs' lifetime, and the exported
 * query keys and invalidation keep their meaning.
 */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MediaClient, SignedMediaUrlsOptions, SignedMediaUrlsResult } from "../../client";
import { createMediaQueryHooks } from "..";

const T0 = Date.UTC(2026, 8, 23, 12, 0, 0);

interface Deferred {
  release: () => void;
}

function createFakeClient({ lifetimeSeconds = 86_400 }: { lifetimeSeconds?: number | null } = {}) {
  let signature = 0;
  const gates: Deferred[] = [];
  let holdNext = false;

  const getSignedUrls = jest.fn(
    async ({ keys, path }: SignedMediaUrlsOptions): Promise<SignedMediaUrlsResult> => {
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => gates.push({ release: resolve }));
      }
      signature += 1;
      const expires = lifetimeSeconds === null ? "" : `&X-Amz-Expires=${lifetimeSeconds}`;
      return {
        urls: Object.fromEntries(
          keys.map((key) => [
            key,
            `https://bucket.example/${path ? `${path}/` : ""}${key}?X-Amz-Signature=${signature}${expires}`,
          ]),
        ),
      };
    },
  );

  const client = {
    getSignedUrls,
    getUploadUrl: jest.fn(),
    upload: jest.fn(),
    list: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  } as unknown as MediaClient;

  return {
    client,
    getSignedUrls,
    /** The next request waits until `releaseAll()`. */
    holdNextRequest: () => {
      holdNext = true;
    },
    releaseAll: () => {
      for (const gate of gates.splice(0)) gate.release();
    },
  };
}

let now = T0;
let queryClient: QueryClient;

beforeEach(() => {
  now = T0;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  queryClient.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function renderSignedUrls(
  hooks: ReturnType<typeof createMediaQueryHooks>,
  initialProps: { keys: string[]; path?: string },
) {
  return renderHook(
    ({ keys, path }: { keys: string[]; path?: string }) =>
      hooks.useSignedMediaUrls({ mediaKeys: keys, path }),
    { initialProps, wrapper },
  );
}

/** The resolved `staleTime` of the cached query for `keys`. */
function staleTimeOf(hooks: ReturnType<typeof createMediaQueryHooks>, keys: string[], path?: string) {
  const query = queryClient.getQueryCache().find({ queryKey: hooks.queryKeys.signedUrls(keys, path), exact: true });
  const staleTime = query?.observers[0]?.options.staleTime;
  return typeof staleTime === "function" ? staleTime(query as never) : staleTime;
}

describe("useSignedMediaUrls", () => {
  it("signs only the added key after an upload, and keeps the others' URLs while it does", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderSignedUrls(hooks, { keys: ["a", "b"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.getSignedUrls).toHaveBeenCalledTimes(1);
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a", "b"], path: undefined });
    const before = result.current.data!.urls;

    fake.holdNextRequest();
    await rerender({ keys: ["a", "b", "c"] });

    // While `c` signs, the list shows what the cache has instead of nothing.
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.urls).toEqual({ a: before.a, b: before.b });

    await act(async () => fake.releaseAll());
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));

    expect(fake.getSignedUrls).toHaveBeenCalledTimes(2);
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["c"], path: undefined });
    expect(result.current.data!.urls).toEqual({
      a: before.a,
      b: before.b,
      c: expect.stringContaining("/c?X-Amz-Signature=2"),
    });
    expect(result.current.data!.urlExpiresAt).toEqual({
      a: T0 + 86_400_000,
      b: T0 + 86_400_000,
      c: T0 + 86_400_000,
    });
  });

  it("serves a shorter list from the cache after a delete, without a request", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderSignedUrls(hooks, { keys: ["a", "b", "c"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const before = result.current.data!.urls;

    await rerender({ keys: ["a", "c"] });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data!.urls).toEqual({ a: before.a, c: before.c });
    expect(fake.getSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("stays fresh for the URLs' lifetime, less the margin", async () => {
    const day = createFakeClient({ lifetimeSeconds: 86_400 });
    const dayHooks = createMediaQueryHooks({ client: day.client, queryKeyNamespace: "day" });
    const { result: dayResult } = await renderSignedUrls(dayHooks, { keys: ["a"] });
    await waitFor(() => expect(dayResult.current.isSuccess).toBe(true));
    // Five minutes early for a day-long URL.
    expect(staleTimeOf(dayHooks, ["a"])).toBe(86_400_000 - 5 * 60_000);

    const minute = createFakeClient({ lifetimeSeconds: 60 });
    const minuteHooks = createMediaQueryHooks({ client: minute.client, queryKeyNamespace: "minute" });
    const { result: minuteResult } = await renderSignedUrls(minuteHooks, { keys: ["a"] });
    await waitFor(() => expect(minuteResult.current.isSuccess).toBe(true));
    // 10% early for a short one.
    expect(staleTimeOf(minuteHooks, ["a"])).toBe(54_000);
  });

  it("re-signs a URL that is due for replacement instead of reusing it", async () => {
    const fake = createFakeClient({ lifetimeSeconds: 60 });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderSignedUrls(hooks, { keys: ["a", "b"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    now = T0 + 55_000; // past the 54-second refresh point
    await rerender({ keys: ["a", "b", "c"] });
    await waitFor(() => expect(fake.getSignedUrls).toHaveBeenCalledTimes(2));

    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a", "b", "c"], path: undefined });
  });

  it("re-signs every key of an invalidated list", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result } = await renderSignedUrls(hooks, { keys: ["a", "b"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const before = result.current.data!.urls;

    await act(() => queryClient.invalidateQueries({ queryKey: hooks.queryKeys.signedUrls(["a", "b"]) }));
    await waitFor(() => expect(fake.getSignedUrls).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data!.urls.a).not.toBe(before.a));

    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a", "b"], path: undefined });
  });

  it("does not reuse URLs from a list invalidated through the namespace key", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const first = await renderSignedUrls(hooks, { keys: ["a", "b"] });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await first.unmount();

    // Inactive, so it stays invalidated instead of refetching.
    await act(() => queryClient.invalidateQueries({ queryKey: ["media", "signed-urls"] }));

    const second = await renderSignedUrls(hooks, { keys: ["a", "b", "c"] });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a", "b", "c"], path: undefined });
  });

  it("keeps URLs for different paths apart", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const thumbnails = await renderSignedUrls(hooks, { keys: ["a.jpg"], path: "thumbnails" });
    await waitFor(() => expect(thumbnails.result.current.isSuccess).toBe(true));

    const full = await renderSignedUrls(hooks, { keys: ["a.jpg"] });
    await waitFor(() => expect(full.result.current.isSuccess).toBe(true));

    expect(fake.getSignedUrls).toHaveBeenCalledTimes(2);
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a.jpg"], path: undefined });
    expect(full.result.current.data!.urls["a.jpg"]).not.toBe(thumbnails.result.current.data!.urls["a.jpg"]);
  });

  it("never reuses a URL that states no lifetime, and keeps the client's default staleTime for it", async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 12_345 } } });
    const fake = createFakeClient({ lifetimeSeconds: null });
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result, rerender } = await renderSignedUrls(hooks, { keys: ["a", "b"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.urlExpiresAt).toEqual({});
    expect(staleTimeOf(hooks, ["a", "b"])).toBe(12_345);

    await rerender({ keys: ["a", "b", "c"] });
    await waitFor(() => expect(fake.getSignedUrls).toHaveBeenCalledTimes(2));
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["a", "b", "c"], path: undefined });
  });

  it("reuses URLs an app put in the cache itself, estimating their lifetime from the URL", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    queryClient.setQueryData(hooks.queryKeys.signedUrls(["a"]), {
      urls: { a: "https://bucket.example/a?X-Amz-Expires=3600&X-Amz-Signature=seeded" },
    });

    const { result } = await renderSignedUrls(hooks, { keys: ["a", "b"] });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fake.getSignedUrls).toHaveBeenCalledTimes(1);
    expect(fake.getSignedUrls).toHaveBeenLastCalledWith({ keys: ["b"], path: undefined });
    expect(result.current.data!.urls.a).toContain("X-Amz-Signature=seeded");
    expect(result.current.data!.urlExpiresAt!.a).toBe(T0 + 3_600_000);
  });

  it("keeps the exported query keys and the alias", () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client, queryKeyNamespace: "files" });

    expect(hooks.queryKeys.signedUrls(["a", "b"])).toEqual(["files", "signed-urls", ["a", "b"], ""]);
    expect(hooks.queryKeys.signedUrls(["a"], "thumbnails")).toEqual(["files", "signed-urls", ["a"], "thumbnails"]);
    expect(hooks.useSignedUrls).toBe(hooks.useSignedMediaUrls);
  });

  it("stays idle without keys, and while disabled", async () => {
    const fake = createFakeClient();
    const hooks = createMediaQueryHooks({ client: fake.client });
    const { result: empty } = await renderSignedUrls(hooks, { keys: [] });
    const { result: disabled } = await renderHook(
      () => hooks.useSignedMediaUrls({ mediaKeys: ["a"], enabled: false }),
      { wrapper },
    );

    expect(empty.current.fetchStatus).toBe("idle");
    expect(empty.current.data).toBeUndefined();
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(disabled.current.data).toBeUndefined();
    expect(fake.getSignedUrls).not.toHaveBeenCalled();
  });
});
