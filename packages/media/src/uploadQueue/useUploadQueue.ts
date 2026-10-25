import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PickedMediaAsset } from "../picker/types";
import { countUploadQueueItems, isUploadQueueActive, type UploadQueueCounts } from "./reducer";
import { createUploadQueueRunner } from "./runner";
import type { UploadQueueItem, UploadQueueOptions } from "./types";

export interface UseUploadQueueResult {
  /** Insertion order. Every item is visible from the moment it is added. */
  items: readonly UploadQueueItem[];
  /**
   * Queue assets. Each is processed, then uploaded, inside the queue, so the UI
   * can show a file the moment it is picked. Ids already in the queue are skipped.
   */
  add: (assets: readonly PickedMediaAsset[]) => void;
  /** Re-run a failed item: from upload if it was already processed, else from processing. */
  retry: (id: string) => void;
  /** Drop one item. An in-flight one disappears at once and its eventual result is ignored. */
  remove: (id: string) => void;
  /** Drop the `done` items. `failed` ones stay until `retry` or `remove`. */
  clearFinished: () => void;
  /** Drop everything. */
  clear: () => void;
  /** True while anything is queued, processing, or uploading. */
  isActive: boolean;
  counts: UploadQueueCounts;
}

/**
 * Process and upload picked assets through a per-item state machine with bounded
 * concurrency.
 *
 * Options may be inline: the latest are read at each step, so changing `upload`,
 * `resolve`, or a callback between renders neither restarts the queue nor leaves
 * a stale closure running.
 *
 * The queue is not tied to the component's effects, so StrictMode, Fast Refresh,
 * and hidden `Activity` screens never drop uploads. Unmounting stops rendering
 * and nothing else: queued items still process and upload, and the callbacks
 * still fire, which is what lets an upload outlive the screen that started it.
 *
 * On web, `blob:` URLs the queue holds are revoked when their item is removed or
 * cleared, never on failure (`retry` needs the bytes) and never on unmount.
 */
export function useUploadQueue<TMediaType extends string = string>(
  options: UploadQueueOptions<TMediaType>,
): UseUploadQueueResult {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [runner] = useState(() => createUploadQueueRunner<TMediaType>(() => optionsRef.current));

  const items = useSyncExternalStore(runner.subscribe, runner.getItems, runner.getItems);
  const counts = useMemo(() => countUploadQueueItems(items), [items]);
  const isActive = useMemo(() => isUploadQueueActive(items), [items]);

  return {
    items,
    add: runner.add,
    retry: runner.retry,
    remove: runner.remove,
    clearFinished: runner.clearFinished,
    clear: runner.clear,
    isActive,
    counts,
  };
}
