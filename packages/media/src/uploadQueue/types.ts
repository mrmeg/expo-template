/**
 * Upload queue contracts.
 *
 * Field names on `UploadQueueItem` are consumed structurally by UI components
 * (`@mrmeg/expo-ui/components/UploadQueue` renders `items` directly), so renaming
 * one is a breaking change on both packages.
 */

import type { MediaUploadOptions, MediaUploadResult } from "../client";
import type { ImagePlatformAdapter } from "../processing/adapter";
import type { CompressionConfig } from "../processing/imageCompression/config";
import type {
  ContentTypeAllowlist,
  ProcessAssetOptions,
  ProcessedUpload,
  ProcessingPhase,
  ProcessedUploadKind,
} from "../processing/processAsset";
import type { PickedMediaAsset } from "../picker/types";

/**
 * Where an item is in its life. `queued` waits for a slot; `processing` and
 * `uploading` hold one; `done` and `failed` are terminal until `retry`.
 */
export type UploadQueueStatus = "queued" | "processing" | "uploading" | "done" | "failed";

export interface UploadQueueItem {
  /** The picked asset's id. */
  id: string;
  fileName: string;
  kind: ProcessedUploadKind;
  status: UploadQueueStatus;
  /**
   * Something an `<Image>` can show: the source uri while queued or processing,
   * then the processed uri (the thumbnail's uri for a video that has one).
   */
  previewUri?: string;
  /** 0..1 when known. Video conversion reports 0-100 upstream; this is normalized. */
  progress?: number;
  /** The processing step in flight, while `status` is `processing`. */
  phase?: ProcessingPhase["type"];
  /** Short and user-presentable. The raw failure is in `error`. */
  errorMessage?: string;
  error?: unknown;
  asset: PickedMediaAsset;
  /** Kept after an upload failure so `retry` does not process again. */
  processed?: ProcessedUpload;
  /** Storage key, once uploaded. */
  key?: string;
  /** The media type `resolve` chose for this asset. */
  mediaType?: string;
}

/** What `resolve` decides for one asset, before it is processed. */
export interface UploadQueueResolution<TMediaType extends string = string> {
  /** The storage bucket prefix the upload goes to, e.g. `"avatars"`. */
  mediaType: TMediaType;
  /** Resolved ladder config; `null` or unset skips the ladder (videos, passthrough). */
  compression?: CompressionConfig | null;
}

export interface UploadQueueVideoThumbnailOptions<TMediaType extends string = string> {
  /** Media type the thumbnail is stored under, e.g. `"thumbnails"`. */
  mediaType: TMediaType;
  /**
   * `customFilename` for the thumbnail, from the video's storage key. Defaults to
   * the key's basename without its extension, so the thumbnail pairs with the video.
   */
  filename?: (videoKey: string) => string;
}

/** What one drained run produced. Items are the latest state, not a snapshot. */
export interface UploadQueueSummary {
  uploaded: UploadQueueItem[];
  failed: UploadQueueItem[];
}

export interface UploadQueueOptions<TMediaType extends string = string> {
  /**
   * Signs and transfers one file. Pass the React Query mutation's `mutateAsync`
   * (it invalidates the list queries) or `client.upload`. There is no abort
   * signal: removing an in-flight item ignores its result, it does not cancel.
   */
  upload: (options: MediaUploadOptions<TMediaType>) => Promise<MediaUploadResult>;
  /** The content types the server accepts. Same list on both sides. */
  allowlist: ContentTypeAllowlist;
  /**
   * Runs once per asset, synchronously, when it is added, and its answer is
   * kept for the item's life (retries included). So the policy that applies is
   * the one current at pick time, even if the screen's inputs change while the
   * item waits for a slot. This is where an avatar gets the avatar preset and a
   * video skips compression. A throw fails the item when it starts.
   */
  resolve: (asset: PickedMediaAsset) => UploadQueueResolution<TMediaType>;
  /**
   * Processing and uploading together, since each in-flight asset holds a
   * full-resolution bitmap. Default 3.
   */
  concurrency?: number;
  /**
   * Upload metadata for the signing request. Replaces the default, which
   * forwards the EXIF facts as `{ takenAt: ISO string, lat: string, lng: string }`
   * (only the keys present, `undefined` when none).
   */
  metadata?: (item: UploadQueueItem, processed: ProcessedUpload) => unknown;
  /**
   * Upload the extracted frame of each video as a second, best-effort file; a
   * failure is dropped and never fails the item. Unset or `false` uploads no
   * thumbnails: there is no default media type to put them under.
   */
  videoThumbnail?: UploadQueueVideoThumbnailOptions<TMediaType> | false;
  /** An item reached `done` or `failed`. */
  onItemSettled?: (item: UploadQueueItem) => void;
  /**
   * The queue drained: nothing queued, processing, or uploading. Fires once per
   * run, with the items that settled during it, still present, by final status.
   */
  onSettled?: (summary: UploadQueueSummary) => void;
  /** Test seam: the platform image adapter handed to `processAsset`. */
  adapter?: ImagePlatformAdapter;
  /** Test seam: replaces `processAsset`. */
  processAsset?: (options: ProcessAssetOptions) => Promise<ProcessedUpload>;
}
