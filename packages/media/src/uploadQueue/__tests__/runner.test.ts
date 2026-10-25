/**
 * The runner drives the reducer with real async work. `processAsset` and
 * `upload` wait on promises each test settles, so ordering is explicit: a test
 * says "processing a finishes" instead of sleeping and hoping.
 */

import { MediaError } from "../../errors";
import { MediaProcessingError } from "../../processing/errors";
import type { ProcessedThumbnail } from "../../processing/processAsset";
import { createUploadQueueRunner } from "../runner";
import type { UploadQueueSummary } from "../types";
import {
  createHarness,
  deferred,
  flush,
  makeAsset,
  makeProcessed,
  statuses,
} from "./helpers";

const thumbnail: ProcessedThumbnail = {
  uri: "blob:thumb-1",
  contentType: "image/jpeg",
  width: 320,
  height: 180,
  size: 900,
};

const videoAsset = (id: string) =>
  makeAsset(id, { uri: `file:///${id}.mov`, contentType: "video/quicktime", kind: "video" });

const processedVideo = (overrides = {}) =>
  makeProcessed({
    kind: "video",
    uri: "file:///video.mp4",
    contentType: "video/mp4",
    size: 50_000,
    thumbnail,
    ...overrides,
  });

describe("concurrency", () => {
  it("never holds more slots than the cap across processing and uploading together", async () => {
    const h = createHarness({ concurrency: 2 });
    h.runner.add(["a", "b", "c", "d", "e"].map((id) => makeAsset(id)));
    await flush();

    const held = () =>
      h.runner.getItems().filter((i) => i.status === "processing" || i.status === "uploading").length;
    expect(h.processCalls).toHaveLength(2);
    expect(held()).toBe(2);

    // a finishes processing and moves to upload: still one slot, so c must wait.
    h.processCalls[0].result.resolve(makeProcessed());
    await flush();
    expect(h.uploadCalls).toHaveLength(1);
    expect(h.processCalls).toHaveLength(2);
    expect(held()).toBe(2);

    // a finishes uploading: its slot goes to c.
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/a.jpg"));
    await flush();
    expect(h.processCalls).toHaveLength(3);
    expect(held()).toBe(2);
    expect(statuses(h.runner.getItems())).toEqual({
      a: "done",
      b: "processing",
      c: "processing",
      d: "queued",
      e: "queued",
    });
  });

  it("defaults to three and treats a non-positive cap as one", async () => {
    const h = createHarness();
    h.runner.add(["a", "b", "c", "d"].map((id) => makeAsset(id)));
    await flush();
    expect(h.processCalls).toHaveLength(3);

    const strict = createHarness({ concurrency: 0 });
    strict.runner.add(["a", "b"].map((id) => makeAsset(id)));
    await flush();
    expect(strict.processCalls).toHaveLength(1);
  });

  it("shows every item the moment it is added", () => {
    const h = createHarness({ concurrency: 1 });

    h.runner.add(["a", "b"].map((id) => makeAsset(id)));

    expect(statuses(h.runner.getItems())).toEqual({ a: "processing", b: "queued" });
    expect(h.find("b").previewUri).toBe("file:///b.jpg");
  });
});

describe("resolve and processing", () => {
  it("resolves per asset before processing and hands compression to processAsset", async () => {
    const avatarConfig = { rungs: [512], quality: 0.8, byteBudget: 1, passthroughBytes: 0, format: null };
    const resolve = jest.fn((asset: { id: string }) =>
      asset.id === "avatar"
        ? { mediaType: "avatars", compression: avatarConfig }
        : { mediaType: "videos", compression: null },
    );
    const h = createHarness({ resolve });

    h.runner.add([makeAsset("avatar"), videoAsset("clip")]);
    await flush();

    expect(h.processCalls[0].options.config).toBe(avatarConfig);
    expect(h.processCalls[0].options.allowlist).toBe(h.options.allowlist);
    expect(h.processCalls[1].options.config).toBeNull();
    expect(h.find("avatar").mediaType).toBe("avatars");

    h.processCalls[0].result.resolve(makeProcessed());
    h.processCalls[1].result.resolve(processedVideo());
    await flush();
    expect(h.uploadCalls.map((call) => call.options.mediaType)).toEqual(["avatars", "videos"]);
  });

  it("takes the policy when an item is added, not when it gets a slot", async () => {
    // A screen's filter, changed while the second file waits for the only slot.
    let current = "avatars";
    const resolve = jest.fn(() => ({ mediaType: current }));
    const h = createHarness({ concurrency: 1, resolve });

    h.runner.add([makeAsset("a"), makeAsset("b")]);
    current = "uploads";
    await flush();
    h.processCalls[0].result.resolve(makeProcessed());
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("users/avatars/a.jpg"));
    await flush();

    expect(h.find("b").mediaType).toBe("avatars");
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("keeps the policy through a retry from processing", async () => {
    let current = "avatars";
    const resolve = jest.fn(() => ({ mediaType: current }));
    const h = createHarness({ resolve });

    h.runner.add([makeAsset("a")]);
    await flush();
    h.processCalls[0].result.reject(new Error("decode"));
    await flush();
    expect(h.find("a").status).toBe("failed");

    current = "uploads";
    h.runner.retry("a");
    await flush();

    expect(h.find("a")).toMatchObject({ status: "processing", mediaType: "avatars" });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("passes the injected adapter through", async () => {
    const adapter = {} as never;
    const h = createHarness({ adapter });

    h.runner.add([makeAsset("a")]);
    await flush();

    expect(h.processCalls[0].options.adapter).toBe(adapter);
  });

  it("surfaces the processing phase and normalized progress while converting", async () => {
    const h = createHarness();
    h.runner.add([videoAsset("v")]);
    await flush();

    h.processCalls[0].options.onPhase?.(h.processCalls[0].options.asset, {
      type: "converting-video",
      progress: 25,
    });
    expect(h.find("v")).toMatchObject({ status: "processing", phase: "converting-video", progress: 0.25 });

    h.processCalls[0].result.resolve(processedVideo());
    await flush();
    expect(h.find("v")).toMatchObject({ status: "uploading", phase: undefined, progress: undefined });
  });

  it("ignores phases that arrive after the item was removed", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();

    h.runner.remove("a");
    h.processCalls[0].options.onPhase?.(h.processCalls[0].options.asset, { type: "compressing" });

    expect(h.runner.getItems()).toEqual([]);
  });

  it("fails an item whose resolve throws, without taking a slot", async () => {
    const h = createHarness({
      concurrency: 1,
      resolve: (asset) => {
        if (asset.id === "bad") throw new Error("no policy");
        return { mediaType: "uploads" };
      },
    });

    h.runner.add([makeAsset("bad"), makeAsset("good")]);
    await flush();

    expect(h.find("bad")).toMatchObject({
      status: "failed",
      errorMessage: "This file could not be prepared.",
    });
    expect(h.find("good").status).toBe("processing");
    expect(h.processCalls).toHaveLength(1);
  });
});

describe("upload and metadata", () => {
  it("uploads the processed Blob (or uri) with content type, size, and media type", async () => {
    const blob = new Blob(["abc"], { type: "image/jpeg" });
    const h = createHarness();
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    h.processCalls[0].result.resolve(makeProcessed({ blob, size: 3 }));
    h.processCalls[1].result.resolve(makeProcessed({ uri: "file:///b-out.jpg", size: 0 }));
    await flush();

    expect(h.uploadCalls[0].options).toMatchObject({
      file: blob,
      contentType: "image/jpeg",
      mediaType: "uploads",
      size: 3,
    });
    expect(h.uploadCalls[1].options.file).toBe("file:///b-out.jpg");
    expect(h.uploadCalls[1].options).not.toHaveProperty("size");
  });

  it("forwards EXIF as string metadata by default, only the keys present", async () => {
    const h = createHarness();
    h.runner.add([
      makeAsset("full", {
        exif: { takenAt: new Date("2024-03-09T14:05:30.000Z"), lat: 37.5, lng: -122.25 },
      }),
      makeAsset("time", { exif: { takenAt: new Date("2024-03-09T14:05:30.000Z") } }),
      makeAsset("none"),
    ]);
    await flush();
    h.processCalls.forEach((call) => call.result.resolve(makeProcessed()));
    await flush();

    expect(h.uploadCalls[0].options.metadata).toEqual({
      takenAt: "2024-03-09T14:05:30.000Z",
      lat: "37.5",
      lng: "-122.25",
    });
    expect(h.uploadCalls[1].options.metadata).toEqual({ takenAt: "2024-03-09T14:05:30.000Z" });
    expect(h.uploadCalls[2].options).not.toHaveProperty("metadata");
  });

  it("lets the app replace the metadata, handing it the item and processed result", async () => {
    const metadata = jest.fn(() => ({ source: "test" }));
    const h = createHarness({ metadata });
    h.runner.add([makeAsset("a")]);
    await flush();

    const processed = makeProcessed();
    h.processCalls[0].result.resolve(processed);
    await flush();

    expect(metadata).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", status: "uploading", mediaType: "uploads" }),
      processed,
    );
    expect(h.uploadCalls[0].options.metadata).toEqual({ source: "test" });
  });

  it("marks the item done with its storage key", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();
    h.processCalls[0].result.resolve(makeProcessed());
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/01A.jpg"));
    await flush();

    expect(h.find("a")).toMatchObject({ status: "done", key: "uploads/01A.jpg" });
  });
});

describe("video thumbnails", () => {
  async function uploadVideo(overrides: Parameters<typeof createHarness>[0] = {}) {
    const h = createHarness({
      videoThumbnail: { mediaType: "thumbnails" },
      resolve: () => ({ mediaType: "videos" }),
      ...overrides,
    });
    h.runner.add([videoAsset("v")]);
    await flush();
    h.processCalls[0].result.resolve(processedVideo());
    await flush();
    return h;
  }

  it("uploads the thumbnail after the video, named after the video key", async () => {
    const h = await uploadVideo();
    h.uploadCalls[0].result.resolve(h.uploaded("videos/01VIDEO.mp4"));
    await flush();

    expect(h.uploadCalls).toHaveLength(2);
    expect(h.uploadCalls[1].options).toMatchObject({
      file: "blob:thumb-1",
      contentType: "image/jpeg",
      mediaType: "thumbnails",
      customFilename: "01VIDEO",
      size: 900,
    });
    // The item is not done until the thumbnail attempt has finished.
    expect(h.find("v").status).toBe("uploading");
    h.uploadCalls[1].result.resolve(h.uploaded("thumbnails/01VIDEO.jpg"));
    await flush();
    expect(h.find("v")).toMatchObject({ status: "done", key: "videos/01VIDEO.mp4" });
  });

  it("uses the thumbnail's Blob when it has one, and a custom filename", async () => {
    const blob = new Blob(["t"], { type: "image/jpeg" });
    const h = createHarness({
      videoThumbnail: { mediaType: "thumbnails", filename: (key) => `thumb-of-${key.split("/")[1]}` },
      resolve: () => ({ mediaType: "videos" }),
    });
    h.runner.add([videoAsset("v")]);
    await flush();
    h.processCalls[0].result.resolve(processedVideo({ thumbnail: { ...thumbnail, blob } }));
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("videos/abc.mp4"));
    await flush();

    expect(h.uploadCalls[1].options).toMatchObject({ file: blob, customFilename: "thumb-of-abc.mp4" });
  });

  it("does not fail the item when the thumbnail upload fails", async () => {
    const h = await uploadVideo();
    h.uploadCalls[0].result.resolve(h.uploaded("videos/01VIDEO.mp4"));
    await flush();
    h.uploadCalls[1].result.reject(new Error("thumbnail storage down"));
    await flush();

    expect(h.find("v")).toMatchObject({ status: "done", key: "videos/01VIDEO.mp4" });
    expect(h.find("v").errorMessage).toBeUndefined();
  });

  it("uploads no thumbnail when disabled, unconfigured, not extracted, or for an image", async () => {
    for (const videoThumbnail of [false as const, undefined]) {
      const h = createHarness({ videoThumbnail, resolve: () => ({ mediaType: "videos" }) });
      h.runner.add([videoAsset("v")]);
      await flush();
      h.processCalls[0].result.resolve(processedVideo());
      await flush();
      h.uploadCalls[0].result.resolve(h.uploaded("videos/v.mp4"));
      await flush();
      expect(h.uploadCalls).toHaveLength(1);
      expect(h.find("v").status).toBe("done");
    }

    const bare = createHarness({
      videoThumbnail: { mediaType: "thumbnails" },
      resolve: () => ({ mediaType: "videos" }),
    });
    bare.runner.add([videoAsset("v")]);
    await flush();
    bare.processCalls[0].result.resolve(processedVideo({ thumbnail: undefined }));
    await flush();
    bare.uploadCalls[0].result.resolve(bare.uploaded("videos/v.mp4"));
    await flush();
    expect(bare.uploadCalls).toHaveLength(1);

    const image = createHarness({ videoThumbnail: { mediaType: "thumbnails" } });
    image.runner.add([makeAsset("i")]);
    await flush();
    image.processCalls[0].result.resolve(makeProcessed({ thumbnail }));
    await flush();
    image.uploadCalls[0].result.resolve(image.uploaded("uploads/i.jpg"));
    await flush();
    expect(image.uploadCalls).toHaveLength(1);
  });
});

describe("failure and retry", () => {
  it("fails an item whose processing throws, with a short message and the raw error", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    const error = new MediaProcessingError("decode-failed", "internal detail");
    h.processCalls[0].result.reject(error);
    await flush();

    expect(h.find("a")).toMatchObject({
      status: "failed",
      errorMessage: "This image could not be read.",
      error,
    });
    expect(h.find("b").status).toBe("processing");
  });

  it("fails an item whose upload throws, keeping the processed result", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();
    const processed = makeProcessed();
    h.processCalls[0].result.resolve(processed);
    await flush();

    const error = new MediaError({ kind: "bad-request", code: "oversized-file", message: "big" });
    h.uploadCalls[0].result.reject(error);
    await flush();

    expect(h.find("a")).toMatchObject({
      status: "failed",
      errorMessage: "This file is too large.",
      error,
      processed,
    });
  });

  it("retries a processing failure from processing", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();
    h.processCalls[0].result.reject(new Error("flaky"));
    await flush();

    h.runner.retry("a");
    await flush();

    expect(h.processCalls).toHaveLength(2);
    expect(h.find("a")).toMatchObject({ status: "processing", errorMessage: undefined });
    h.processCalls[1].result.resolve(makeProcessed());
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/a.jpg"));
    await flush();
    expect(h.find("a").status).toBe("done");
  });

  it("retries an upload failure from upload, without processing again", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();
    const processed = makeProcessed();
    h.processCalls[0].result.resolve(processed);
    await flush();
    h.uploadCalls[0].result.reject(new Error("offline"));
    await flush();

    h.runner.retry("a");
    await flush();

    expect(h.processCalls).toHaveLength(1);
    expect(h.uploadCalls).toHaveLength(2);
    expect(h.find("a")).toMatchObject({ status: "uploading", mediaType: "uploads" });
    expect(h.uploadCalls[1].options.contentType).toBe(processed.contentType);
    h.uploadCalls[1].result.resolve(h.uploaded("uploads/a.jpg"));
    await flush();
    expect(h.find("a")).toMatchObject({ status: "done", key: "uploads/a.jpg" });
  });

  it("only retries failed items", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await flush();

    h.runner.retry("a");
    h.runner.retry("ghost");
    await flush();

    expect(h.processCalls).toHaveLength(1);
  });

  it("queues a retry behind the concurrency cap", async () => {
    const h = createHarness({ concurrency: 1 });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();
    h.processCalls[0].result.reject(new Error("x"));
    await flush();
    expect(h.find("b").status).toBe("processing");

    h.runner.retry("a");

    expect(h.find("a").status).toBe("queued");
  });
});

describe("remove", () => {
  it("drops an item mid-processing at once and ignores its eventual result", async () => {
    const onItemSettled = jest.fn();
    const h = createHarness({ onItemSettled });
    h.runner.add([makeAsset("a")]);
    await flush();

    h.runner.remove("a");
    expect(h.runner.getItems()).toEqual([]);

    h.processCalls[0].result.resolve(makeProcessed());
    await flush();

    expect(h.uploadCalls).toHaveLength(0);
    expect(h.runner.getItems()).toEqual([]);
    expect(onItemSettled).not.toHaveBeenCalled();
  });

  it("ignores the result of an upload that was in flight", async () => {
    const onItemSettled = jest.fn();
    const h = createHarness({ onItemSettled, videoThumbnail: { mediaType: "thumbnails" } });
    h.runner.add([videoAsset("v")]);
    await flush();
    h.processCalls[0].result.resolve(processedVideo());
    await flush();

    h.runner.remove("v");
    h.uploadCalls[0].result.resolve(h.uploaded("videos/v.mp4"));
    await flush();

    expect(h.runner.getItems()).toEqual([]);
    expect(h.uploadCalls).toHaveLength(1); // no thumbnail for a removed item
    expect(onItemSettled).not.toHaveBeenCalled();
  });

  it("ignores a failure from removed work", async () => {
    const onItemSettled = jest.fn();
    const h = createHarness({ onItemSettled });
    h.runner.add([makeAsset("a")]);
    await flush();

    h.runner.remove("a");
    h.processCalls[0].result.reject(new Error("late"));
    await flush();

    expect(h.runner.getItems()).toEqual([]);
    expect(onItemSettled).not.toHaveBeenCalled();
  });

  it("keeps the slot until the abandoned work really settles", async () => {
    const h = createHarness({ concurrency: 1 });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    h.runner.remove("a");
    await flush();
    expect(h.processCalls).toHaveLength(1);
    expect(h.find("b").status).toBe("queued");

    h.processCalls[0].result.resolve(makeProcessed());
    await flush();
    expect(h.processCalls).toHaveLength(2);
    expect(h.find("b").status).toBe("processing");
  });

  it("does not let an abandoned run write into an item re-added under the same id", async () => {
    const h = createHarness({ concurrency: 2 });
    const asset = makeAsset("a");
    h.runner.add([asset]);
    await flush();

    h.runner.remove("a");
    h.runner.add([asset]);
    await flush();
    expect(h.processCalls).toHaveLength(2);

    h.processCalls[0].result.resolve(makeProcessed({ uri: "file:///stale.jpg" }));
    await flush();
    expect(h.find("a")).toMatchObject({ status: "processing", previewUri: asset.uri });
    expect(h.uploadCalls).toHaveLength(0);

    h.processCalls[1].result.resolve(makeProcessed({ uri: "file:///fresh.jpg" }));
    await flush();
    expect(h.find("a")).toMatchObject({ status: "uploading", previewUri: "file:///fresh.jpg" });
  });

  it("removes a queued item without it ever starting", async () => {
    const h = createHarness({ concurrency: 1 });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    h.runner.remove("b");
    h.processCalls[0].result.resolve(makeProcessed());
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/a.jpg"));
    await flush();

    expect(h.processCalls).toHaveLength(1);
    expect(h.runner.getItems().map((item) => item.id)).toEqual(["a"]);
  });
});

describe("clearing", () => {
  it("clearFinished drops done items and keeps failed and active ones", async () => {
    const h = createHarness({ concurrency: 3 });
    h.runner.add([makeAsset("done"), makeAsset("bad"), makeAsset("busy")]);
    await flush();
    h.processCalls[0].result.resolve(makeProcessed());
    h.processCalls[1].result.reject(new Error("x"));
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/done.jpg"));
    await flush();

    h.runner.clearFinished();

    expect(statuses(h.runner.getItems())).toEqual({ bad: "failed", busy: "processing" });
  });

  it("clear drops everything, in flight included, and ignores what comes back", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    h.runner.clear();
    h.processCalls.forEach((call) => call.result.resolve(makeProcessed()));
    await flush();

    expect(h.runner.getItems()).toEqual([]);
    expect(h.uploadCalls).toHaveLength(0);
  });
});

describe("blob URL revocation", () => {
  let revoke: jest.SpyInstance;

  beforeEach(() => {
    revoke = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  async function finishOne(h: ReturnType<typeof createHarness>, processed = makeProcessed()) {
    await flush();
    h.processCalls[0].result.resolve(processed);
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/a.jpg"));
    await flush();
  }

  it("revokes the processed, thumbnail, and source blob uris when a finished item is removed", async () => {
    const h = createHarness({ resolve: () => ({ mediaType: "videos" }) });
    h.runner.add([videoAsset("a")]);
    await finishOne(h, processedVideo({ uri: "blob:video-out" }));
    expect(revoke).not.toHaveBeenCalled();

    h.runner.remove("a");

    expect(revoke.mock.calls.map(([uri]) => uri).sort()).toEqual(["blob:thumb-1", "blob:video-out"]);
  });

  it("revokes a source blob uri that passthrough also used, once", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a", { uri: "blob:source" })]);
    await finishOne(h, makeProcessed({ uri: "blob:source" }));

    h.runner.remove("a");

    expect(revoke.mock.calls).toEqual([["blob:source"]]);
  });

  it("never revokes native file uris", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a")]);
    await finishOne(h);

    h.runner.clear();

    expect(revoke).not.toHaveBeenCalled();
  });

  it("keeps the blobs of a failed item so a retry still has them", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a", { uri: "blob:source" })]);
    await flush();
    h.processCalls[0].result.resolve(makeProcessed({ uri: "blob:out" }));
    await flush();
    h.uploadCalls[0].result.reject(new Error("offline"));
    await flush();

    expect(revoke).not.toHaveBeenCalled();

    h.runner.clear();
    expect(revoke.mock.calls.map(([uri]) => uri).sort()).toEqual(["blob:out", "blob:source"]);
  });

  it("revokes clearFinished items and leaves failed ones alone", async () => {
    const h = createHarness({ concurrency: 2 });
    h.runner.add([makeAsset("ok", { uri: "blob:ok" }), makeAsset("bad", { uri: "blob:bad" })]);
    await flush();
    h.processCalls[0].result.resolve(makeProcessed({ uri: "blob:ok-out" }));
    h.processCalls[1].result.reject(new Error("x"));
    await flush();
    h.uploadCalls[0].result.resolve(h.uploaded("uploads/ok.jpg"));
    await flush();

    h.runner.clearFinished();

    expect(revoke.mock.calls.map(([uri]) => uri).sort()).toEqual(["blob:ok", "blob:ok-out"]);
  });

  it("holds the source uri while the item processes, and revokes when the work settles", async () => {
    const h = createHarness();
    h.runner.add([makeAsset("a", { uri: "blob:source" })]);
    await flush();

    h.runner.remove("a");
    expect(revoke).not.toHaveBeenCalled();

    h.processCalls[0].result.resolve(makeProcessed({ uri: "blob:late-out" }));
    await flush();
    expect(revoke.mock.calls.map(([uri]) => uri).sort()).toEqual(["blob:late-out", "blob:source"]);
  });

  it("does not revoke a uri that a re-added item still shows", async () => {
    const h = createHarness({ concurrency: 2 });
    const asset = makeAsset("a", { uri: "blob:source" });
    h.runner.add([asset]);
    await flush();
    h.runner.remove("a");
    h.runner.add([asset]);
    await flush();

    h.processCalls[0].result.resolve(makeProcessed({ uri: "blob:source" }));
    await flush();

    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("onItemSettled and onSettled", () => {
  async function runToDone(h: ReturnType<typeof createHarness>, index: number) {
    h.processCalls[index].result.resolve(makeProcessed());
    await flush();
    // The upload this process call just started is the newest one.
    h.uploadCalls[h.uploadCalls.length - 1].result.resolve(h.uploaded(`uploads/${index}.jpg`));
    await flush();
  }

  it("calls onItemSettled for each done or failed item with its latest state", async () => {
    const onItemSettled = jest.fn();
    const h = createHarness({ onItemSettled });
    h.runner.add([makeAsset("ok"), makeAsset("bad")]);
    await flush();

    h.processCalls[1].result.reject(new Error("x"));
    await flush();
    await runToDone(h, 0);

    expect(onItemSettled.mock.calls.map(([item]) => [item.id, item.status])).toEqual([
      ["bad", "failed"],
      ["ok", "done"],
    ]);
  });

  it("fires onSettled once when the queue drains, with this run's outcomes", async () => {
    const summaries: UploadQueueSummary[] = [];
    const h = createHarness({ concurrency: 2, onSettled: (summary) => summaries.push(summary) });
    h.runner.add([makeAsset("a"), makeAsset("b"), makeAsset("c")]);
    await flush();

    await runToDone(h, 0);
    expect(summaries).toHaveLength(0); // b and c are still going
    h.processCalls[1].result.reject(new Error("x"));
    await flush();
    expect(summaries).toHaveLength(0);
    await runToDone(h, 2); // c is the third process call

    expect(summaries).toHaveLength(1);
    expect(summaries[0].uploaded.map((item) => item.id).sort()).toEqual(["a", "c"]);
    expect(summaries[0].failed.map((item) => item.id)).toEqual(["b"]);
  });

  it("fires again for the next run, and only reports that run", async () => {
    const summaries: UploadQueueSummary[] = [];
    const h = createHarness({ onSettled: (summary) => summaries.push(summary) });
    h.runner.add([makeAsset("a")]);
    await flush();
    await runToDone(h, 0);

    h.runner.add([makeAsset("b")]);
    await flush();
    await runToDone(h, 1);

    expect(summaries.map((s) => s.uploaded.map((item) => item.id))).toEqual([["a"], ["b"]]);
    expect(summaries.every((s) => s.failed.length === 0)).toBe(true);
  });

  it("joins items added mid-run to the same run", async () => {
    const summaries: UploadQueueSummary[] = [];
    const h = createHarness({ concurrency: 1, onSettled: (summary) => summaries.push(summary) });
    h.runner.add([makeAsset("a")]);
    await flush();

    h.runner.add([makeAsset("b")]);
    await runToDone(h, 0);
    expect(summaries).toHaveLength(0);
    await runToDone(h, 1);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].uploaded.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("reports an item retried to success in the run that finished it, not as failed", async () => {
    const summaries: UploadQueueSummary[] = [];
    const h = createHarness({ concurrency: 2, onSettled: (summary) => summaries.push(summary) });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();
    h.processCalls[0].result.reject(new Error("x"));
    await flush();
    h.runner.retry("a");
    await flush();
    await runToDone(h, 1);
    await runToDone(h, 2);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].failed).toEqual([]);
    expect(summaries[0].uploaded.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("does not fire when every settled item was removed", async () => {
    const onSettled = jest.fn();
    const h = createHarness({ onSettled });
    h.runner.add([makeAsset("a")]);
    await flush();
    await runToDone(h, 0);
    expect(onSettled).toHaveBeenCalledTimes(1);

    h.runner.add([makeAsset("b")]);
    await flush();
    h.processCalls[1].result.reject(new Error("x"));
    await flush();
    expect(onSettled).toHaveBeenCalledTimes(2);

    onSettled.mockClear();
    h.runner.add([makeAsset("c")]);
    await flush();
    h.runner.remove("c");
    h.processCalls[2].result.resolve(makeProcessed());
    await flush();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("waits for abandoned work to settle before reporting the drain", async () => {
    const summaries: UploadQueueSummary[] = [];
    const h = createHarness({ concurrency: 2, onSettled: (summary) => summaries.push(summary) });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();
    await runToDone(h, 0);

    h.runner.remove("b");
    expect(summaries).toHaveLength(0);

    h.processCalls[1].result.resolve(makeProcessed());
    await flush();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].uploaded.map((item) => item.id)).toEqual(["a"]);
  });

  it("fires for a queue where every item failed to resolve", () => {
    const onSettled = jest.fn();
    const h = createHarness({
      onSettled,
      resolve: () => {
        throw new Error("no policy");
      },
    });

    h.runner.add([makeAsset("a"), makeAsset("b")]);

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0][0].failed).toHaveLength(2);
  });

  it("survives callbacks that throw", async () => {
    const h = createHarness({
      onItemSettled: () => {
        throw new Error("app bug");
      },
      onSettled: () => {
        throw new Error("app bug");
      },
    });
    h.runner.add([makeAsset("a"), makeAsset("b")]);
    await flush();

    await runToDone(h, 0);
    await runToDone(h, 1);

    expect(statuses(h.runner.getItems())).toEqual({ a: "done", b: "done" });
  });
});

describe("subscription and lifecycle", () => {
  it("notifies subscribers on change, keeps the snapshot stable otherwise, and unsubscribes", async () => {
    const h = createHarness();
    const listener = jest.fn();
    const unsubscribe = h.runner.subscribe(listener);
    const empty = h.runner.getItems();

    h.runner.remove("ghost");
    expect(h.runner.getItems()).toBe(empty);
    expect(listener).not.toHaveBeenCalled();

    h.runner.add([makeAsset("a")]);
    expect(listener).toHaveBeenCalled();
    expect(h.runner.getItems()).not.toBe(empty);

    unsubscribe();
    listener.mockClear();
    h.runner.clear();
    expect(listener).not.toHaveBeenCalled();
  });

  it("reads the latest options at every step", async () => {
    const first = jest.fn();
    const second = jest.fn();
    let current = { onItemSettled: first };
    const processCalls: ReturnType<typeof deferred<ReturnType<typeof makeProcessed>>>[] = [];
    const uploads: ReturnType<typeof deferred<{ key: string; uploadUrl: string; expiresAt: string }>>[] = [];
    const runner = createUploadQueueRunner<string>(() => ({
      allowlist: { image: ["image/jpeg"], video: ["video/mp4"] },
      resolve: () => ({ mediaType: "uploads" }),
      processAsset: () => {
        const d = deferred<ReturnType<typeof makeProcessed>>();
        processCalls.push(d);
        return d.promise;
      },
      upload: () => {
        const d = deferred<{ key: string; uploadUrl: string; expiresAt: string }>();
        uploads.push(d);
        return d.promise;
      },
      ...current,
    }));

    runner.add([makeAsset("a")]);
    await flush();
    current = { onItemSettled: second };
    processCalls[0].resolve(makeProcessed());
    await flush();
    uploads[0].resolve({ key: "k", uploadUrl: "u", expiresAt: "e" });
    await flush();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
