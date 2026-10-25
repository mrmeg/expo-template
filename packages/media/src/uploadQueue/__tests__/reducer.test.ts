/**
 * The state machine on its own: every legal transition, and the guarantee that a
 * late or out-of-order action cannot rewind or resurrect an item.
 */

import {
  countUploadQueueItems,
  initialUploadQueueState,
  isUploadQueueActive,
  uploadQueueReducer,
  type UploadQueueState,
} from "../reducer";
import { makeAsset, makeProcessed } from "./helpers";

function stateWith(...ids: string[]): UploadQueueState {
  return uploadQueueReducer(initialUploadQueueState, {
    type: "add",
    assets: ids.map((id) => makeAsset(id)),
  });
}

const failure = { error: new Error("x"), errorMessage: "x" };

describe("uploadQueueReducer", () => {
  it("adds items as queued, previewing the source uri", () => {
    const state = stateWith("a", "b");

    expect(state.items.map((item) => [item.id, item.status, item.previewUri])).toEqual([
      ["a", "queued", "file:///a.jpg"],
      ["b", "queued", "file:///b.jpg"],
    ]);
    expect(state.items[0]).toMatchObject({ fileName: "a.jpg", kind: "image" });
  });

  it("skips ids that are already queued, and returns the same state when nothing is new", () => {
    const state = stateWith("a");

    expect(uploadQueueReducer(state, { type: "add", assets: [makeAsset("a")] })).toBe(state);
  });

  it("names unnamed files from the uri and infers video from the content type", () => {
    const state = uploadQueueReducer(initialUploadQueueState, {
      type: "add",
      assets: [
        makeAsset("v", {
          fileName: null,
          kind: null,
          contentType: "video/mp4",
          uri: "file:///tmp/clip.mp4?x=1",
        }),
      ],
    });

    expect(state.items[0]).toMatchObject({ fileName: "clip.mp4", kind: "video" });
  });

  it("walks queued -> processing -> uploading -> done", () => {
    let state = stateWith("a");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    expect(state.items[0]).toMatchObject({ status: "processing", mediaType: "uploads" });

    const processed = makeProcessed();
    state = uploadQueueReducer(state, { type: "processed", id: "a", processed });
    expect(state.items[0]).toMatchObject({
      status: "uploading",
      processed,
      previewUri: "file:///processed.jpg",
    });

    state = uploadQueueReducer(state, { type: "uploaded", id: "a", key: "uploads/a.jpg" });
    expect(state.items[0]).toMatchObject({ status: "done", key: "uploads/a.jpg" });
  });

  it("previews a processed video by its thumbnail", () => {
    let state = stateWith("v");
    state = uploadQueueReducer(state, { type: "start", id: "v", mediaType: "videos" });
    state = uploadQueueReducer(state, {
      type: "processed",
      id: "v",
      processed: makeProcessed({
        kind: "video",
        uri: "file:///v.mp4",
        thumbnail: {
          uri: "file:///frame.jpg",
          contentType: "image/jpeg",
          width: 10,
          height: 10,
          size: 10,
        },
      }),
    });

    expect(state.items[0]).toMatchObject({ kind: "video", previewUri: "file:///frame.jpg" });
  });

  it("records the phase and normalizes video conversion progress from 0-100 to 0..1", () => {
    let state = stateWith("v");
    state = uploadQueueReducer(state, { type: "start", id: "v", mediaType: "videos" });

    state = uploadQueueReducer(state, {
      type: "phase",
      id: "v",
      phase: { type: "converting-video", progress: 40 },
    });
    expect(state.items[0]).toMatchObject({ phase: "converting-video", progress: 0.4 });

    state = uploadQueueReducer(state, {
      type: "phase",
      id: "v",
      phase: { type: "converting-video", progress: 140 },
    });
    expect(state.items[0].progress).toBe(1);

    state = uploadQueueReducer(state, {
      type: "phase",
      id: "v",
      phase: { type: "converting-video", loadingConverter: true },
    });
    expect(state.items[0]).toMatchObject({ phase: "converting-video", progress: undefined });

    state = uploadQueueReducer(state, { type: "phase", id: "v", phase: { type: "compressing" } });
    expect(state.items[0]).toMatchObject({ phase: "compressing", progress: undefined });
  });

  it("fails from processing or uploading, keeping what a retry needs", () => {
    const processed = makeProcessed();
    let state = stateWith("a", "b");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "start", id: "b", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "processed", id: "b", processed });

    state = uploadQueueReducer(state, { type: "failed", id: "a", ...failure });
    state = uploadQueueReducer(state, { type: "failed", id: "b", ...failure });

    expect(state.items[0]).toMatchObject({ status: "failed", errorMessage: "x" });
    expect(state.items[0].processed).toBeUndefined();
    expect(state.items[1]).toMatchObject({ status: "failed", errorMessage: "x", processed });
    expect(state.items[1].error).toBe(failure.error);
  });

  it("retries a failed item back to queued, then restarts it where it left off", () => {
    let state = stateWith("a", "b");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "failed", id: "a", ...failure });
    state = uploadQueueReducer(state, { type: "start", id: "b", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "processed", id: "b", processed: makeProcessed() });
    state = uploadQueueReducer(state, { type: "failed", id: "b", ...failure });

    state = uploadQueueReducer(state, { type: "retry", id: "a" });
    state = uploadQueueReducer(state, { type: "retry", id: "b" });
    expect(state.items.map((item) => item.status)).toEqual(["queued", "queued"]);
    expect(state.items[0]).toMatchObject({ error: undefined, errorMessage: undefined });

    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "start", id: "b", mediaType: "uploads" });
    expect(state.items.map((item) => item.status)).toEqual(["processing", "uploading"]);
  });

  it("ignores actions for missing items and actions out of sequence", () => {
    const state = stateWith("a");

    expect(uploadQueueReducer(state, { type: "uploaded", id: "a", key: "k" })).toBe(state);
    expect(
      uploadQueueReducer(state, { type: "processed", id: "a", processed: makeProcessed() }),
    ).toBe(state);
    expect(uploadQueueReducer(state, { type: "phase", id: "a", phase: { type: "compressing" } })).toBe(
      state,
    );
    expect(uploadQueueReducer(state, { type: "retry", id: "a" })).toBe(state);
    expect(uploadQueueReducer(state, { type: "start", id: "ghost", mediaType: "x" })).toBe(state);

    const done = uploadQueueReducer(
      uploadQueueReducer(
        uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" }),
        { type: "processed", id: "a", processed: makeProcessed() },
      ),
      { type: "uploaded", id: "a", key: "k" },
    );
    expect(uploadQueueReducer(done, { type: "failed", id: "a", ...failure })).toBe(done);
  });

  it("removes ids, drops done items on clear-finished, and empties on clear", () => {
    let state = stateWith("a", "b", "c");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "processed", id: "a", processed: makeProcessed() });
    state = uploadQueueReducer(state, { type: "uploaded", id: "a", key: "k" });
    state = uploadQueueReducer(state, { type: "start", id: "b", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "failed", id: "b", ...failure });

    const finished = uploadQueueReducer(state, { type: "clear-finished" });
    expect(finished.items.map((item) => item.id)).toEqual(["b", "c"]);

    expect(uploadQueueReducer(state, { type: "remove", ids: ["c"] }).items.map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
    expect(uploadQueueReducer(state, { type: "remove", ids: ["ghost"] })).toBe(state);
    expect(uploadQueueReducer(state, { type: "clear" }).items).toEqual([]);
    expect(uploadQueueReducer(initialUploadQueueState, { type: "clear" })).toBe(initialUploadQueueState);
  });
});

describe("countUploadQueueItems / isUploadQueueActive", () => {
  it("counts every status and reports activity", () => {
    let state = stateWith("a", "b", "c");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "start", id: "b", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "failed", id: "b", ...failure });

    expect(countUploadQueueItems(state.items)).toEqual({
      queued: 1,
      processing: 1,
      uploading: 0,
      done: 0,
      failed: 1,
    });
    expect(isUploadQueueActive(state.items)).toBe(true);
  });

  it("is idle when everything is finished or empty", () => {
    let state = stateWith("a");
    state = uploadQueueReducer(state, { type: "start", id: "a", mediaType: "uploads" });
    state = uploadQueueReducer(state, { type: "failed", id: "a", ...failure });

    expect(isUploadQueueActive(state.items)).toBe(false);
    expect(isUploadQueueActive([])).toBe(false);
  });
});
