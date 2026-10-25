/**
 * The upload queue's engine: scheduling, bounded concurrency, and side effects
 * around the pure reducer. It has no React in it, so it runs (and is tested) as
 * plain async code; `useUploadQueue` is a thin subscription on top.
 *
 * A *slot* is held from the moment an item starts until its work settles. That
 * includes work whose item was removed meanwhile: `upload()` cannot be aborted
 * and processing cannot be interrupted, so an orphan still holds its
 * full-resolution bitmap, and starting a replacement would break the memory
 * ceiling `concurrency` exists to enforce. An orphan's result is ignored and its
 * blob URLs are revoked when it settles.
 */

import type { PickedMediaAsset } from "../picker/types";
import type { CompressionConfig } from "../processing/imageCompression/config";
import { logMediaDebug } from "../processing/logger";
import { processAsset as defaultProcessAsset } from "../processing/processAsset";
import type { ProcessedUpload } from "../processing/processAsset";
import { describeUploadQueueError, type UploadQueueStage } from "./errors";
import { buildExifUploadMetadata } from "./metadata";
import { initialUploadQueueState, uploadQueueReducer } from "./reducer";
import type { UploadQueueAction, UploadQueueState } from "./reducer";
import type {
  UploadQueueItem,
  UploadQueueOptions,
  UploadQueueResolution,
  UploadQueueSummary,
} from "./types";

export const DEFAULT_UPLOAD_QUEUE_CONCURRENCY = 3;

export interface UploadQueueRunner {
  /** Stable between changes, so it is a valid `useSyncExternalStore` snapshot. */
  getItems(): readonly UploadQueueItem[];
  subscribe(listener: () => void): () => void;
  add(assets: readonly PickedMediaAsset[]): void;
  /** Re-run a failed item: from processing, or from upload if it was processed. */
  retry(id: string): void;
  remove(id: string): void;
  /** Drop `done` items. `failed` ones stay: they are waiting on `retry` or `remove`. */
  clearFinished(): void;
  clear(): void;
}

function revokeObjectUrl(uri: string): void {
  if (!uri.startsWith("blob:")) return;
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(uri);
  } catch (error) {
    logMediaDebug(`Could not revoke ${uri}: ${String(error)}`);
  }
}

/** Every uri an item owns: what the picker handed over and what processing made. */
function urisOf(asset: PickedMediaAsset, processed: ProcessedUpload | undefined): string[] {
  return [asset.uri, processed?.uri, processed?.thumbnail?.uri].filter(
    (uri): uri is string => typeof uri === "string",
  );
}

function defaultThumbnailFilename(videoKey: string): string {
  const name = videoKey.split("/").pop() || "";
  return name.replace(/\.[^.]+$/, "");
}

/** One execution of one item. A retry is a new attempt with a new token. */
interface Attempt {
  token: number;
  asset: PickedMediaAsset;
  /** Processed before this attempt (retry from upload). */
  existing?: ProcessedUpload;
  /** Produced by this attempt. */
  produced?: ProcessedUpload;
}

export function createUploadQueueRunner<TMediaType extends string = string>(
  getOptions: () => UploadQueueOptions<TMediaType>,
): UploadQueueRunner {
  let state: UploadQueueState = initialUploadQueueState;
  const listeners = new Set<() => void>();

  let tokenSequence = 0;
  /** id -> token of the attempt that may still write to that item. */
  const live = new Map<string, number>();
  /** Tokens whose work has not settled, orphaned or not: the held slots. */
  const running = new Set<number>();
  /** Items that settled since the queue last drained. */
  const settledIds = new Set<string>();
  /**
   * What `resolve` decided for each item, taken when the item was added, so a
   * screen whose inputs change mid-run (a filter, a toggle) still uploads every
   * queued file with the policy that was current when it was picked.
   */
  const resolutions = new Map<string, UploadQueueResolution<TMediaType>>();
  /** Items whose `resolve` threw when they were added; they fail when they start. */
  const resolveErrors = new Map<string, unknown>();

  /** Resolve each asset not already in the queue, once, at the moment it is added. */
  function resolveOnAdd(assets: readonly PickedMediaAsset[]): void {
    const { resolve } = getOptions();
    for (const asset of assets) {
      if (resolutions.has(asset.id) || resolveErrors.has(asset.id) || itemById(asset.id)) continue;
      try {
        resolutions.set(asset.id, resolve(asset));
      } catch (error) {
        resolveErrors.set(asset.id, error);
      }
    }
  }

  function forget(id: string): void {
    resolutions.delete(id);
    resolveErrors.delete(id);
  }

  function dispatch(action: UploadQueueAction): void {
    const next = uploadQueueReducer(state, action);
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function itemById(id: string): UploadQueueItem | undefined {
    return state.items.find((item) => item.id === id);
  }

  /** Callbacks are the app's; a throw in one must not break the queue. */
  function safely(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      logMediaDebug(`Upload queue callback threw: ${String(error)}`);
    }
  }

  function isReferenced(uri: string): boolean {
    return state.items.some(
      (item) =>
        item.asset.uri === uri ||
        item.previewUri === uri ||
        item.processed?.uri === uri ||
        item.processed?.thumbnail?.uri === uri,
    );
  }

  /** Revoke what `uris` names, unless an item still in the queue shows it. */
  function revokeUnreferenced(uris: readonly string[]): void {
    for (const uri of new Set(uris)) {
      if (!isReferenced(uri)) revokeObjectUrl(uri);
    }
  }

  function settle(id: string): void {
    settledIds.add(id);
    const item = itemById(id);
    const { onItemSettled } = getOptions();
    if (item && onItemSettled) safely(() => onItemSettled(item));
  }

  function checkDrain(): void {
    if (running.size > 0 || settledIds.size === 0) return;
    if (state.items.some((item) => item.status === "queued")) return;

    const summary: UploadQueueSummary = { uploaded: [], failed: [] };
    for (const id of settledIds) {
      const item = itemById(id);
      if (item?.status === "done") summary.uploaded.push(item);
      else if (item?.status === "failed") summary.failed.push(item);
    }
    settledIds.clear();

    const { onSettled } = getOptions();
    if (onSettled && (summary.uploaded.length > 0 || summary.failed.length > 0)) {
      safely(() => onSettled(summary));
    }
  }

  async function runAttempt(
    attempt: Attempt,
    id: string,
    mediaType: TMediaType,
    compression: CompressionConfig | null | undefined,
  ): Promise<void> {
    const isLive = () => live.get(id) === attempt.token;
    let stage: UploadQueueStage = "processing";
    let processed = attempt.existing;

    try {
      if (!processed) {
        const options = getOptions();
        const process = options.processAsset ?? defaultProcessAsset;
        processed = await process({
          asset: attempt.asset,
          allowlist: options.allowlist,
          config: compression,
          adapter: options.adapter,
          onPhase: (_asset, phase) => {
            if (isLive()) dispatch({ type: "phase", id, phase });
          },
        });
        attempt.produced = processed;
        if (!isLive()) return;
        dispatch({ type: "processed", id, processed });
      }

      stage = "uploading";
      const options = getOptions();
      const item = itemById(id);
      const metadata = options.metadata
        ? options.metadata(item ?? fallbackItem(attempt.asset, processed), processed)
        : buildExifUploadMetadata(attempt.asset.exif);

      const result = await options.upload({
        file: processed.blob ?? processed.uri,
        contentType: processed.contentType,
        mediaType,
        ...(processed.size > 0 ? { size: processed.size } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      });
      if (!isLive()) return;

      await uploadThumbnail(processed, result.key, isLive);
      if (!isLive()) return;

      dispatch({ type: "uploaded", id, key: result.key });
      settle(id);
    } catch (error) {
      if (!isLive()) return;
      logMediaDebug(`Upload queue: ${id} failed while ${stage}: ${String(error)}`);
      dispatch({
        type: "failed",
        id,
        error,
        errorMessage: describeUploadQueueError(error, stage),
      });
      settle(id);
    } finally {
      running.delete(attempt.token);
      if (isLive()) live.delete(id);
      else {
        revokeUnreferenced([
          ...urisOf(attempt.asset, attempt.existing),
          ...urisOf(attempt.asset, attempt.produced),
        ]);
      }
      pump();
    }
  }

  /** `metadata` needs an item even if the queue dropped it between steps. */
  function fallbackItem(asset: PickedMediaAsset, processed: ProcessedUpload): UploadQueueItem {
    return {
      id: asset.id,
      fileName: asset.fileName || asset.id,
      kind: processed.kind,
      status: "uploading",
      asset,
      processed,
    };
  }

  /** Best effort, by design: a missing thumbnail never costs a good upload. */
  async function uploadThumbnail(
    processed: ProcessedUpload,
    videoKey: string,
    isLive: () => boolean,
  ): Promise<void> {
    const options = getOptions();
    const config = options.videoThumbnail;
    const thumbnail = processed.thumbnail;
    if (!config || processed.kind !== "video" || !thumbnail || !isLive()) return;

    try {
      const filename = (config.filename ?? defaultThumbnailFilename)(videoKey);
      await options.upload({
        file: thumbnail.blob ?? thumbnail.uri,
        contentType: thumbnail.contentType,
        mediaType: config.mediaType,
        ...(thumbnail.size > 0 ? { size: thumbnail.size } : {}),
        ...(filename ? { customFilename: filename } : {}),
      });
    } catch (error) {
      logMediaDebug(`Video thumbnail upload failed for ${videoKey}: ${String(error)}`);
    }
  }

  function start(item: UploadQueueItem): void {
    const options = getOptions();
    let mediaType: TMediaType;
    let compression: CompressionConfig | null | undefined;

    if (item.processed) {
      // Retry from upload: the media type was settled the first time round.
      mediaType = item.mediaType as TMediaType;
    } else {
      try {
        // Taken at `add`. Missing only on a retry after `resolve` threw, which
        // asks again now.
        const failure = resolveErrors.get(item.id);
        resolveErrors.delete(item.id);
        if (failure !== undefined) throw failure;
        let resolved = resolutions.get(item.id);
        if (!resolved) {
          resolved = options.resolve(item.asset);
          resolutions.set(item.id, resolved);
        }
        mediaType = resolved.mediaType;
        compression = resolved.compression;
      } catch (error) {
        logMediaDebug(`Upload queue: resolve threw for ${item.id}: ${String(error)}`);
        dispatch({
          type: "failed",
          id: item.id,
          error,
          errorMessage: describeUploadQueueError(error, "resolving"),
        });
        settle(item.id);
        return;
      }
    }

    const attempt: Attempt = {
      token: ++tokenSequence,
      asset: item.asset,
      existing: item.processed,
    };
    live.set(item.id, attempt.token);
    running.add(attempt.token);
    dispatch({ type: "start", id: item.id, mediaType });
    void runAttempt(attempt, item.id, mediaType, compression);
  }

  function pump(): void {
    const requested = Math.floor(getOptions().concurrency ?? DEFAULT_UPLOAD_QUEUE_CONCURRENCY);
    const limit = Math.max(1, Number.isFinite(requested) ? requested : DEFAULT_UPLOAD_QUEUE_CONCURRENCY);

    while (running.size < limit) {
      const next = state.items.find((item) => item.status === "queued");
      if (!next) break;
      start(next);
    }
    checkDrain();
  }

  /**
   * Drop items. Work still in flight for one is orphaned (its token no longer
   * matches) and cleans its own URLs up when it settles: they may be in use.
   */
  function drop(items: readonly UploadQueueItem[]): void {
    const idle: UploadQueueItem[] = [];
    for (const item of items) {
      if (live.has(item.id)) live.delete(item.id);
      else idle.push(item);
    }
    dispatch({ type: "remove", ids: items.map((item) => item.id) });
    for (const item of items) {
      settledIds.delete(item.id);
      forget(item.id);
    }
    revokeUnreferenced(idle.flatMap((item) => urisOf(item.asset, item.processed)));
  }

  return {
    getItems: () => state.items,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    add(assets) {
      resolveOnAdd(assets);
      dispatch({ type: "add", assets });
      pump();
    },

    retry(id) {
      dispatch({ type: "retry", id });
      pump();
    },

    remove(id) {
      const item = itemById(id);
      if (!item) return;
      drop([item]);
      pump();
    },

    clearFinished() {
      drop(state.items.filter((item) => item.status === "done"));
    },

    clear() {
      drop(state.items);
      settledIds.clear();
    },
  };
}
