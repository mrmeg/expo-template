/**
 * Headless upload queue.
 *
 * Takes `PickedMediaAsset`s (from `/picker`, or any `ProcessAssetInput` with an
 * id), processes each with `processAsset`, and uploads it through whatever
 * `upload` function the app passes, with bounded concurrency. It renders nothing
 * and imports no picker, React Query, or UI: progress is `items`, and toasts,
 * alerts, and refetches belong to the app's `onSettled`.
 */

export { useUploadQueue, type UseUploadQueueResult } from "./useUploadQueue";
export {
  backfillVideoThumbnail,
  type BackfillVideoThumbnailInput,
  type BackfillVideoThumbnailOptions,
  type BackfillVideoThumbnailResult,
} from "./backfill";
export {
  useVideoThumbnailBackfill,
  type UseVideoThumbnailBackfillOptions,
  type UseVideoThumbnailBackfillResult,
} from "./useVideoThumbnailBackfill";
export { createUploadQueueRunner, type UploadQueueRunner } from "./runner";
export {
  countUploadQueueItems,
  initialUploadQueueState,
  isUploadQueueActive,
  uploadQueueReducer,
  type UploadQueueAction,
  type UploadQueueCounts,
  type UploadQueueState,
} from "./reducer";
export { buildExifUploadMetadata } from "./metadata";
export { describeUploadQueueError, type UploadQueueStage } from "./errors";
export type {
  UploadQueueItem,
  UploadQueueOptions,
  UploadQueueResolution,
  UploadQueueStatus,
  UploadQueueSummary,
  UploadQueueVideoThumbnailOptions,
} from "./types";
export type {
  PickedMediaAsset,
  PickedMediaExif,
} from "../picker/types";
