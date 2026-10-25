/**
 * The per-item state machine, as a pure reducer.
 *
 * Transitions: `queued -> processing -> uploading -> done`, with `failed`
 * reachable from the middle two and `failed -> queued` on retry. An item whose
 * `processed` result survived an upload failure restarts at `uploading`. Actions
 * for an item that is gone, or not in the status the action starts from, change
 * nothing: a late result must never resurrect or rewind an item.
 */

import type { PickedMediaAsset } from "../picker/types";
import type { ProcessedUpload, ProcessingPhase } from "../processing/processAsset";
import type { UploadQueueItem, UploadQueueStatus } from "./types";

export interface UploadQueueState {
  items: readonly UploadQueueItem[];
}

export const initialUploadQueueState: UploadQueueState = { items: [] };

export type UploadQueueAction =
  | { type: "add"; assets: readonly PickedMediaAsset[] }
  | { type: "start"; id: string; mediaType: string }
  | { type: "phase"; id: string; phase: ProcessingPhase }
  | { type: "processed"; id: string; processed: ProcessedUpload }
  | { type: "uploaded"; id: string; key: string }
  | { type: "failed"; id: string; error: unknown; errorMessage: string }
  | { type: "retry"; id: string }
  | { type: "remove"; ids: readonly string[] }
  | { type: "clear-finished" }
  | { type: "clear" };

export type UploadQueueCounts = Record<UploadQueueStatus, number>;

export function countUploadQueueItems(items: readonly UploadQueueItem[]): UploadQueueCounts {
  const counts: UploadQueueCounts = { queued: 0, processing: 0, uploading: 0, done: 0, failed: 0 };
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** True while anything is queued, processing, or uploading. */
export function isUploadQueueActive(items: readonly UploadQueueItem[]): boolean {
  return items.some(
    (item) =>
      item.status === "queued" || item.status === "processing" || item.status === "uploading",
  );
}

function basename(uri: string): string {
  return uri.split(/[?#]/)[0].split("/").pop() || "";
}

function createItem(asset: PickedMediaAsset): UploadQueueItem {
  const kind = asset.kind ?? (asset.contentType?.startsWith("video/") ? "video" : "image");
  return {
    id: asset.id,
    fileName: asset.fileName || basename(asset.uri) || asset.id,
    kind,
    status: "queued",
    previewUri: asset.uri,
    asset,
  };
}

/** Video conversion reports 0-100; everything else in the queue is 0..1. */
function normalizeProgress(phase: ProcessingPhase): number | undefined {
  if (phase.type !== "converting-video" || phase.progress === undefined) return undefined;
  if (!Number.isFinite(phase.progress)) return undefined;
  return Math.min(1, Math.max(0, phase.progress / 100));
}

/** What an `<Image>` can show for a processed upload: a video's frame, not its file. */
function previewFor(processed: ProcessedUpload): string {
  return processed.kind === "video" && processed.thumbnail
    ? processed.thumbnail.uri
    : processed.uri;
}

function update(
  state: UploadQueueState,
  id: string,
  from: readonly UploadQueueStatus[],
  patch: (item: UploadQueueItem) => UploadQueueItem,
): UploadQueueState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id || !from.includes(item.status)) return item;
    changed = true;
    return patch(item);
  });
  return changed ? { items } : state;
}

export function uploadQueueReducer(
  state: UploadQueueState,
  action: UploadQueueAction,
): UploadQueueState {
  switch (action.type) {
  case "add": {
    const known = new Set(state.items.map((item) => item.id));
    const fresh = action.assets.filter((asset) => {
      if (known.has(asset.id)) return false;
      known.add(asset.id);
      return true;
    });
    return fresh.length === 0 ? state : { items: [...state.items, ...fresh.map(createItem)] };
  }

  case "start":
    return update(state, action.id, ["queued"], (item) => ({
      ...item,
      // Past processing already (a retry after an upload failure): go straight back.
      status: item.processed ? "uploading" : "processing",
      mediaType: action.mediaType,
      phase: undefined,
      progress: undefined,
      error: undefined,
      errorMessage: undefined,
    }));

  case "phase":
    return update(state, action.id, ["processing"], (item) => ({
      ...item,
      phase: action.phase.type,
      progress: normalizeProgress(action.phase),
    }));

  case "processed":
    return update(state, action.id, ["processing"], (item) => ({
      ...item,
      status: "uploading",
      kind: action.processed.kind,
      processed: action.processed,
      previewUri: previewFor(action.processed),
      phase: undefined,
      progress: undefined,
    }));

  case "uploaded":
    return update(state, action.id, ["uploading"], (item) => ({
      ...item,
      status: "done",
      key: action.key,
      phase: undefined,
      progress: undefined,
      error: undefined,
      errorMessage: undefined,
    }));

  case "failed":
    return update(state, action.id, ["queued", "processing", "uploading"], (item) => ({
      ...item,
      status: "failed",
      error: action.error,
      errorMessage: action.errorMessage,
      phase: undefined,
      progress: undefined,
    }));

  case "retry":
    return update(state, action.id, ["failed"], (item) => ({
      ...item,
      status: "queued",
      error: undefined,
      errorMessage: undefined,
    }));

  case "remove": {
    const gone = new Set(action.ids);
    const items = state.items.filter((item) => !gone.has(item.id));
    return items.length === state.items.length ? state : { items };
  }

  case "clear-finished": {
    const items = state.items.filter((item) => item.status !== "done");
    return items.length === state.items.length ? state : { items };
  }

  case "clear":
    return state.items.length === 0 ? state : initialUploadQueueState;
  }
}
