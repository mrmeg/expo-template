import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapWithConcurrency } from "../processing/concurrency";
import {
  backfillVideoThumbnail,
  type BackfillVideoThumbnailInput,
  type BackfillVideoThumbnailOptions,
  type BackfillVideoThumbnailResult,
} from "./backfill";

export type UseVideoThumbnailBackfillOptions<TMediaType extends string = string> =
  BackfillVideoThumbnailOptions<TMediaType> & {
    /** Videos processed at once. Each one downloads video data. @default 1 */
    concurrency?: number;
    /** A `run` batch finished. Fires once per `run` that started work. */
    onSettled?: (results: BackfillVideoThumbnailResult[]) => void;
  };

export interface UseVideoThumbnailBackfillResult {
  /**
   * Start thumbnails for these videos. Inputs whose `videoKey` is already running
   * (or repeated in the same call) are ignored. Nothing happens until it is called.
   */
  run: (inputs: readonly BackfillVideoThumbnailInput[]) => void;
  /** True while any video is queued or in flight. */
  running: boolean;
  /**
   * Counts since the last time the hook was idle: `done` uploaded, `failed` did
   * not, `total` videos started. `done + failed === total` once settled.
   */
  progress: { done: number; failed: number; total: number };
  /** Outcomes since the last time the hook was idle, in completion order. */
  results: readonly BackfillVideoThumbnailResult[];
}

const IDLE_PROGRESS = { done: 0, failed: 0, total: 0 } as const;
const NO_RESULTS: readonly BackfillVideoThumbnailResult[] = [];

/**
 * Backfill video thumbnails with bounded concurrency. Explicit by design: it
 * downloads video data, so it runs only when `run` is called.
 *
 * Options may be inline: the latest are read as each video starts. Calling `run`
 * while videos are running queues a further batch behind them (`progress.total`
 * grows now), so `concurrency` bounds the whole hook; once idle, the next `run`
 * starts counting from zero. `onSettled` fires once per `run` batch, with that
 * batch's results in input order. Unmounting stops it quietly: videos not yet
 * started are skipped, those in flight finish, and no state is set and
 * `onSettled` does not fire.
 */
export function useVideoThumbnailBackfill<TMediaType extends string>(
  options: UseVideoThumbnailBackfillOptions<TMediaType>,
): UseVideoThumbnailBackfillResult {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const mounted = useRef(true);
  useEffect(() => {
    // Set here, not only in the initial value: StrictMode unmounts and remounts.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** The batch in flight; the next `run` starts when it settles. Never rejects. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** videoKeys queued or in flight. */
  const active = useRef(new Set<string>());
  const [state, setState] = useState<{
    pending: number;
    progress: { done: number; failed: number; total: number };
    results: readonly BackfillVideoThumbnailResult[];
  }>({ pending: 0, progress: IDLE_PROGRESS, results: NO_RESULTS });

  const run = useCallback((inputs: readonly BackfillVideoThumbnailInput[]) => {
    if (!mounted.current) return;
    const batch: BackfillVideoThumbnailInput[] = [];
    for (const input of inputs) {
      if (active.current.has(input.videoKey)) continue;
      active.current.add(input.videoKey);
      batch.push(input);
    }
    if (batch.length === 0) return;

    setState((current) =>
      current.pending === 0
        ? {
            pending: batch.length,
            progress: { done: 0, failed: 0, total: batch.length },
            results: NO_RESULTS,
          }
        : {
            ...current,
            pending: current.pending + batch.length,
            progress: { ...current.progress, total: current.progress.total + batch.length },
          },
    );

    const runBatch = async (): Promise<void> => {
      const settled = await mapWithConcurrency(
        batch,
        optionsRef.current.concurrency ?? 1,
        async (input): Promise<BackfillVideoThumbnailResult | null> => {
          if (!mounted.current) {
            active.current.delete(input.videoKey);
            return null;
          }
          const result = await backfillVideoThumbnail(input, optionsRef.current);
          active.current.delete(input.videoKey);
          if (mounted.current) {
            const uploaded = result.status === "uploaded";
            setState((current) => ({
              pending: current.pending - 1,
              progress: {
                ...current.progress,
                done: current.progress.done + (uploaded ? 1 : 0),
                failed: current.progress.failed + (uploaded ? 0 : 1),
              },
              results: [...current.results, result],
            }));
          }
          return result;
        },
      );

      if (!mounted.current) return;
      try {
        optionsRef.current.onSettled?.(
          settled.filter((result): result is BackfillVideoThumbnailResult => result !== null),
        );
      } catch {
        // The callback is the app's; its failure must not surface as an unhandled rejection.
      }
    };

    // Batches run one after another, so `concurrency` bounds the hook, not each call.
    chain.current = chain.current.then(runBatch);
  }, []);

  return useMemo(
    () => ({ run, running: state.pending > 0, progress: state.progress, results: state.results }),
    [run, state],
  );
}
