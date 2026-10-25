import { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useKeySelection, useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import {
  SansSerifText,
  SansSerifBoldText,
  MonoText,
} from "@mrmeg/expo-ui/components/StyledText";
import { Alert } from "@mrmeg/expo-ui/components/Alert";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { IconButton } from "@mrmeg/expo-ui/components/IconButton";
import { MediaGrid } from "@mrmeg/expo-ui/components/MediaGrid";
import { MediaSelectionBar } from "@mrmeg/expo-ui/components/MediaSelectionBar";
import { MediaTile } from "@mrmeg/expo-ui/components/MediaTile";
import { UploadQueue } from "@mrmeg/expo-ui/components/UploadQueue";
import type { MediaViewerItem } from "@mrmeg/expo-ui/components/MediaViewer";
import { LazyMediaViewer } from "@/client/components/LazyMediaViewer";
import { useMediaList, formatBytes } from "@/client/features/media/hooks/useMediaList";
import { usePairedVideoList } from "@/client/features/media/hooks/usePairedVideoList";
import { withVideoThumbnailKeys } from "@mrmeg/expo-media";
import type { MediaItem } from "@mrmeg/expo-media/client";
import { useMediaPicker } from "@mrmeg/expo-media/picker";
import {
  useUploadQueue,
  useVideoThumbnailBackfill,
  type BackfillVideoThumbnailResult,
  type UploadQueueItem,
} from "@mrmeg/expo-media/upload-queue";
import { useSignedUrls } from "@/client/features/media/hooks/useSignedUrls";
import {
  useMediaDelete,
  useMediaDeleteBatch,
} from "@/client/features/media/hooks/useMediaDelete";
import { useMediaUpload } from "@/client/features/media/hooks/useMediaUpload";
import { isMediaError, MediaError } from "@mrmeg/expo-media/client";
import { isMediaOriginUnconfigured } from "@/client/features/media/mediaClient";
import { useCompressionStore } from "@/client/features/media/stores/compressionStore";
import {
  MEDIA_CONTENT_TYPE_ALLOWLIST,
  MEDIA_PATHS,
  VIDEO_THUMBNAIL_PAIRING,
  isVideoKey,
  isImageKey,
  type MediaType,
} from "@/shared/media";
import {
  MEDIA_APP_SETTINGS,
  resolveMediaUploadPolicy,
} from "@/client/features/media/mediaSettings";
import { notify } from "@mrmeg/expo-ui/state";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { logDev } from "@/client/lib/devtools";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { Seo } from "@/client/components/Seo";
import { useTabHeaderTitle } from "@/client/features/navigation/tabTitle";

/** Thumbnails are not a filter: they show on their videos' tiles. */
type FilterType = "all" | Exclude<keyof typeof MEDIA_PATHS, "thumbnails">;
/**
 * Stand-in for the server's 503 `media-disabled` problem, used when native has
 * no API origin configured. Built once at module scope so the screen's memoized
 * derivations see a stable reference.
 */
const UNCONFIGURED_MEDIA_ERROR = new MediaError({
  kind: "disabled",
  missing: ["EXPO_PUBLIC_API_URL"],
});

const NO_VIEWER_ITEMS: MediaViewerItem[] = [];

const MEDIA_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "avatars", label: "Avatars" },
  { key: "videos", label: "Videos" },
  { key: "uploads", label: "Uploads" },
];

// Media is the content here, so it fills the width: `MediaGrid` sizes square
// tiles to the column (2 up on a phone) and caps and centres it on wide screens.
// The header rows sit in the same capped column.
const MAX_CONTENT_WIDTH = 960;

/**
 * Upload rows drawn above the grid. A 20-file pick would otherwise push the
 * grid off a phone screen; the rest are counted in the queue's footer.
 */
const MAX_VISIBLE_UPLOADS = 3;

/** The app's glyphs for the kit's media components, whose built-in defaults are generic. */
const QUEUE_KIND_ICONS = { image: "image", video: "video" } as const;

/**
 * What a delete sends: the keys, plus each video's thumbnail. The server also
 * deletes thumbnails with their videos (`deleteCompanions`); sending them here
 * as well keeps the pair together against a server that predates that, and a
 * thumbnail that is already gone deletes as a no-op.
 */
function getDeletePayloadKeys(keys: readonly string[]) {
  return MEDIA_APP_SETTINGS.uploads.deleteVideoThumbnailWithVideo
    ? withVideoThumbnailKeys(keys, { pairing: VIDEO_THUMBNAIL_PAIRING, isVideoKey })
    : [...keys];
}

/** Toasts for one backfill run. */
function notifyBackfillRun(results: readonly BackfillVideoThumbnailResult[]) {
  const failed = results.filter((result) => result.status === "failed");
  const created = results.length - failed.length;
  if (failed.length === 0) {
    notify.success("Thumbnails Created", {
      messages: [created === 1 ? "1 thumbnail created" : `${created} thumbnails created`],
      duration: 3000,
    });
    return;
  }
  notify.warning(created === 0 ? "Thumbnails Failed" : "Some Thumbnails Failed", {
    messages: [
      `${created} of ${results.length} thumbnails created`,
      ...failed.slice(0, 2).map((result) => (result.status === "failed" ? result.errorMessage : "")),
    ],
    duration: 6000,
  });
}

/** Toasts for one drained upload run; the per-file detail is on the queue rows. */
function notifyUploadRun({ uploaded, failed }: { uploaded: UploadQueueItem[]; failed: UploadQueueItem[] }) {
  const total = uploaded.length + failed.length;
  if (total === 0) return;

  if (uploaded.length === 0) {
    notify.error(failed.length === 1 ? "Upload Failed" : `${failed.length} Uploads Failed`, {
      messages: failed.slice(0, 3).map((item) => `${item.fileName}: ${item.errorMessage ?? "Failed"}`),
      duration: 6000,
    });
    return;
  }

  if (failed.length > 0) {
    notify.warning("Upload Incomplete", {
      messages: [
        `${uploaded.length} of ${total} files uploaded`,
        `Failed: ${failed.map((item) => item.fileName).join(", ")}`,
      ],
      duration: 6000,
    });
    return;
  }

  notify.success("Uploaded", {
    messages: [
      uploaded.length === 1
        ? uploaded[0].kind === "video"
          ? "Video uploaded successfully"
          : "File uploaded successfully"
        : `${uploaded.length} files uploaded successfully`,
    ],
    duration: 3000,
  });
}

export default function MediaScreen() {
  useTabHeaderTitle("media");
  return useMediaScreenContent();
}

function useMediaScreenContent() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [filter, setFilter] = useState<FilterType>("all");
  // What the viewer was opened with: the items as they were at that moment, and the one tapped. Frozen for the
  // whole visit: every refetch re-signs the URLs, and a `Video` handed a new source restarts what it is playing.
  // `open` is separate so closing keeps the items for the viewer's own exit.
  const [viewer, setViewer] = useState<{ items: MediaViewerItem[]; start: number; open: boolean } | null>(null);

  // Each query's fields are destructured immediately rather than kept in a
  // keyed object or array of query objects. React Compiler widens the mutable
  // range of anything a captured object reaches, so collecting the query objects
  // would mark every value derived from them as mutable and skip memoizing the
  // whole screen (react-hooks/preserve-manual-memoization).
  const avatarsQuery = useMediaList({
    mediaType: "avatars",
    enabled: (filter === "all" || filter === "avatars") && !isMediaOriginUnconfigured,
  });
  // Videos come joined to their thumbnails by ID, so the thumbnails themselves
  // never show as files of their own.
  const videosQuery = usePairedVideoList({
    videoMediaType: "videos",
    thumbnailMediaType: "thumbnails",
    pairing: VIDEO_THUMBNAIL_PAIRING,
    enabled: (filter === "all" || filter === "videos") && !isMediaOriginUnconfigured,
  });
  const uploadsQuery = useMediaList({
    mediaType: "uploads",
    enabled: (filter === "all" || filter === "uploads") && !isMediaOriginUnconfigured,
  });

  const avatarsData = avatarsQuery.data;
  const pairedVideos = videosQuery.data?.videos;
  const uploadsData = uploadsQuery.data;
  const videoItems = useMemo(() => pairedVideos?.map((paired) => paired.video), [pairedVideos]);
  // Each video's stored thumbnail key, for the ones that have one.
  const thumbnailKeyByVideo = useMemo(
    () =>
      new Map(
        (pairedVideos ?? []).flatMap((paired) =>
          paired.thumbnail ? [[paired.video.key, paired.thumbnail.key] as const] : [],
        ),
      ),
    [pairedVideos],
  );

  const isAvatarsActive = filter === "all" || filter === "avatars";
  const isVideosActive = filter === "all" || filter === "videos";
  const isUploadsActive = filter === "all" || filter === "uploads";

  const isLoading =
    (isAvatarsActive && avatarsQuery.isLoading) ||
    (isVideosActive && videosQuery.isLoading) ||
    (isUploadsActive && uploadsQuery.isLoading);
  const isRefetching =
    (isAvatarsActive && avatarsQuery.isRefetching) ||
    (isVideosActive && videosQuery.isRefetching) ||
    (isUploadsActive && uploadsQuery.isRefetching);
  // With no media origin configured (native + blank EXPO_PUBLIC_API_URL) every
  // query above stays disabled, so React Query never produces an error. Feed the
  // screen a synthesized disabled problem instead so the state logic below —
  // mediaDisabled, missingEnvVars, uploadDisabled, and the branch order in the
  // render — keeps working without forking.
  const error = isMediaOriginUnconfigured
    ? UNCONFIGURED_MEDIA_ERROR
    : (isAvatarsActive ? avatarsQuery.error : null) ??
    (isVideosActive ? videosQuery.error : null) ??
    (isUploadsActive ? uploadsQuery.error : null) ??
    null;

  // React Query keeps each refetch referentially stable, so depending on the
  // functions (not the query objects) keeps refetch — and the memoized
  // RefreshControl built from it — stable across renders.
  const refetchAvatars = avatarsQuery.refetch;
  const refetchVideos = videosQuery.refetch;
  const refetchUploads = uploadsQuery.refetch;
  const refetch = useCallback(() => {
    if (isAvatarsActive) void refetchAvatars();
    if (isVideosActive) void refetchVideos();
    if (isUploadsActive) void refetchUploads();
  }, [
    isAvatarsActive,
    isVideosActive,
    isUploadsActive,
    refetchAvatars,
    refetchVideos,
    refetchUploads,
  ]);

  const data = useMemo(() => {
    if (filter !== "all") {
      switch (filter) {
      case "avatars":
        return avatarsData;
      case "videos":
        return videoItems ? { items: videoItems, totalCount: videoItems.length, nextCursor: undefined } : undefined;
      case "uploads":
        return uploadsData;
      }
    }

    const items = [
      ...(avatarsData?.items ?? []),
      ...(videoItems ?? []),
      ...(uploadsData?.items ?? []),
    ];

    return {
      items,
      totalCount: items.length,
      nextCursor: undefined,
    };
  }, [
    filter,
    avatarsData,
    videoItems,
    uploadsData,
  ]);
  const mediaDisabled = isMediaError(error) && error.problem.kind === "disabled";
  const mediaAccessError =
    isMediaError(error) &&
    (error.problem.kind === "unauthorized" || error.problem.kind === "forbidden")
      ? error
      : null;
  const missingEnvVars = mediaDisabled && error.problem.kind === "disabled" ? error.problem.missing : undefined;
  const fetchError = !mediaDisabled && !mediaAccessError && error ? error : null;
  const { mutateAsync: deleteFile, isPending: isDeleting } = useMediaDelete();
  const { mutateAsync: deleteFiles, isPending: isDeletingBatch } =
    useMediaDeleteBatch();
  // The mutation invalidates the list queries after every upload, so new files
  // appear without a manual refetch.
  const { mutateAsync: uploadFile } = useMediaUpload();
  const getCompressionConfig = useCompressionStore((state) => state.getConfig);
  const { pick, picking } = useMediaPicker();

  // Each picked file is processed and uploaded inside the queue, so its row
  // appears the moment it is picked. Options are read at each step, so the
  // inline `resolve` always sees the current filter.
  const queue = useUploadQueue<MediaType>({
    upload: uploadFile,
    allowlist: MEDIA_CONTENT_TYPE_ALLOWLIST,
    concurrency: MEDIA_APP_SETTINGS.processing.concurrency,
    // The upload policy is resolved per asset and before processing, so a
    // mixed selection compresses images, leaves videos alone, and the Avatars
    // filter gets the avatar preset and prefix.
    resolve: (asset) => {
      const { policy } = resolveMediaUploadPolicy(
        { type: asset.kind, mimeType: asset.contentType },
        filter,
      );
      return { mediaType: policy.mediaType, compression: getCompressionConfig(policy.compression) };
    },
    // Thumbnails take their video's ID (`thumbnails/<ID>.jpg`), which is the
    // queue's default and `VIDEO_THUMBNAIL_PAIRING`.
    videoThumbnail: MEDIA_APP_SETTINGS.uploads.uploadVideoThumbnails
      ? { mediaType: "thumbnails" }
      : false,
    onItemSettled: (item) => {
      if (item.status === "failed") logDev(`Upload failed for ${item.fileName}: ${String(item.error)}`);
      else logDev(`Uploaded ${item.fileName} -> ${item.key} [${item.processed?.applied.join(", ")}]`);
    },
    onSettled: (summary) => {
      notifyUploadRun(summary);
      // Uploaded rows have done their job once the toast and the grid show the
      // files; failed rows stay for retry or remove.
      queue.clearFinished();
    },
  });

  const mediaItems = useMemo(() => data?.items ?? [], [data?.items]);
  const visibleKeys = useMemo(
    () => mediaItems.map((item) => item.key),
    [mediaItems]
  );
  const selection = useKeySelection(visibleKeys);
  const { selected: selectedKeys, toggle: toggleSelectedKey, remove: deselectKeys, clear: clearSelection } = selection;
  const isDeleteBusy = isDeleting || isDeletingBatch;
  const uploadDisabled = mediaDisabled || picking;

  const handleDelete = useCallback(async (key: string) => {
    try {
      // A video goes with its thumbnail, in one request.
      const payloadKeys = getDeletePayloadKeys([key]);
      if (payloadKeys.length > 1) await deleteFiles(payloadKeys);
      else await deleteFile(key);
      deselectKeys(payloadKeys);
      notify.success("Deleted", {
        messages: ["File deleted successfully"],
        duration: 3000,
      });
    } catch (error) {
      notify.error("Delete Failed", {
        messages: [
          error instanceof Error ? error.message : "Failed to delete file",
        ],
        duration: 5000,
      });
    }
  }, [deleteFile, deleteFiles, deselectKeys]);

  const handleDeleteSelected = async () => {
    const selectedForDelete = [...selectedKeys];
    if (selectedForDelete.length === 0) return;

    notify.loading("Deleting", {
      messages: [
        selectedForDelete.length === 1
          ? "Deleting selected file..."
          : `Deleting ${selectedForDelete.length} selected files...`,
      ],
    });

    try {
      const payloadKeys = getDeletePayloadKeys(selectedForDelete);
      const result = await deleteFiles(payloadKeys);
      const errorCount = result.errors?.length ?? 0;

      clearSelection();
      notify.hide();

      if (errorCount > 0) {
        notify.warning("Delete Incomplete", {
          messages: [
            `${selectedForDelete.length} selected files processed`,
            `${errorCount} storage item${errorCount === 1 ? "" : "s"} failed`,
          ],
          duration: 6000,
        });
        return;
      }

      notify.success("Deleted", {
        messages: [
          selectedForDelete.length === 1
            ? "Selected file deleted"
            : `${selectedForDelete.length} selected files deleted`,
        ],
        duration: 3000,
      });
    } catch (error) {
      notify.hide();
      notify.error("Delete Failed", {
        messages: [
          error instanceof Error ? error.message : "Failed to delete files",
        ],
        duration: 5000,
      });
    }
  };

  const handleUpload = async () => {
    try {
      const result = await pick({
        mediaTypes: ["images", "videos"],
        multiple: true,
        selectionLimit: MEDIA_APP_SETTINGS.uploads.selectionLimit,
      });
      if (result.status === "denied") {
        Alert.show({
          message: result.canAskAgain
            ? "Allow media library access to upload media."
            : "You have denied media library access. You will need to allow access in your phone's Settings app to upload media.",
        });
        return;
      }
      if (result.status === "picked") queue.add(result.assets);
    } catch (error) {
      notify.error("Upload Failed", {
        messages: [
          error instanceof Error ? error.message : "Could not open the media library",
        ],
        duration: 5000,
      });
    }
  };

  // Get signed URLs for all media items (images and videos) using full keys.
  // flatMap filters and transforms in a single pass.
  const mediaKeys =
    data?.items.flatMap((item) =>
      isImageKey(item.key) || isVideoKey(item.key) ? [item.key] : []
    ) ?? [];

  const { data: signedUrlData } = useSignedUrls({
    mediaKeys,
    // No path - keys are full paths like "media/videos/abc.mp4"
    enabled: mediaKeys.length > 0 && !isMediaOriginUnconfigured,
  });

  // Signed URLs for the thumbnails that exist, by their own object keys. A
  // video without one is never asked for, so nothing 404s.
  const thumbnailKeys = [...thumbnailKeyByVideo.values()];

  const { data: thumbnailUrlData } = useSignedUrls({
    mediaKeys: thumbnailKeys,
    enabled: thumbnailKeys.length > 0 && !isMediaOriginUnconfigured,
  });

  // Videos uploaded before thumbnails worked (or whose thumbnail failed) can
  // get one now: a frame is read from the stored video and uploaded under its
  // ID. It downloads video data, so it runs only when asked.
  const backfill = useVideoThumbnailBackfill<MediaType>({
    upload: uploadFile,
    thumbnailMediaType: "thumbnails",
    onSettled: notifyBackfillRun,
  });
  // An unreadable thumbnail list makes every video look bare; offer nothing then.
  const backfillInputs = videosQuery.thumbnailsError ? [] : (pairedVideos ?? []).flatMap((paired) => {
    const videoUrl = signedUrlData?.urls?.[paired.video.key];
    return !paired.thumbnail && videoUrl ? [{ videoKey: paired.video.key, videoUrl }] : [];
  });

  // One viewer over the whole list, so swiping spans the library: every image and video that has a signed
  // URL yet. Thumbnails are cached under their object key, not the re-signed URL (see renderMediaItem).
  const viewerItems = useMemo<MediaViewerItem[]>(
    () =>
      mediaItems.flatMap((item): MediaViewerItem[] => {
        const signedUrl = signedUrlData?.urls?.[item.key];
        if (!signedUrl) return [];
        const filename = item.key.split("/").pop() || item.key;
        if (isVideoKey(item.key)) {
          const thumbnailKey = thumbnailKeyByVideo.get(item.key);
          const thumbnailUrl = thumbnailKey ? thumbnailUrlData?.urls?.[thumbnailKey] : undefined;
          return [
            {
              type: "video",
              key: item.key,
              source: signedUrl,
              title: filename,
              poster: thumbnailKey && thumbnailUrl ? { uri: thumbnailUrl, cacheKey: thumbnailKey } : undefined,
            },
          ];
        }
        if (isImageKey(item.key)) {
          return [
            {
              type: "image",
              key: item.key,
              source: { uri: signedUrl, cacheKey: item.key },
              alt: filename,
              title: filename,
            },
          ];
        }
        return [];
      }),
    [mediaItems, signedUrlData, thumbnailUrlData, thumbnailKeyByVideo]
  );

  const handleOpenViewer = useCallback(
    (itemKey: string) => {
      const start = viewerItems.findIndex((item) => item.key === itemKey);
      if (start >= 0) setViewer({ items: viewerItems, start, open: true });
    },
    [viewerItems]
  );
  const handleCloseViewer = useCallback(
    () => setViewer((current) => (current ? { ...current, open: false } : current)),
    []
  );

  // Memoize the refresh control so the FlatList doesn't get a brand-new element
  // every render.
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={refetch}
        tintColor={theme.colors.primary}
      />
    ),
    [isRefetching, refetch, theme.colors.primary]
  );

  // Stable renderTile so the grid can window properly; MediaTile is memoized and
  // receives only primitives + stable callbacks, so untouched tiles skip
  // re-rendering when selection or sibling tiles change.
  const renderMediaItem = useCallback(
    ({ item, size }: { item: MediaItem; size: number }) => {
      const isVideo = isVideoKey(item.key);
      const filename = item.key.split("/").pop() || item.key;
      const signedUrl = signedUrlData?.urls?.[item.key];
      const thumbnailKey = isVideo ? thumbnailKeyByVideo.get(item.key) : undefined;
      const thumbnailUrl = thumbnailKey ? thumbnailUrlData?.urls?.[thumbnailKey] : undefined;
      // Thumbnails are cached under their object key, not the signed URL: every
      // refetch re-signs the URL (new query string, same object), so keying on the
      // URL missed expo-image's cache and re-downloaded each thumbnail. Keys are
      // never overwritten with different bytes — uploads get a fresh id, and a
      // video's thumbnail is named after the video.
      const source = isVideo
        ? thumbnailKey && thumbnailUrl
          ? { uri: thumbnailUrl, cacheKey: thumbnailKey }
          : undefined
        : isImageKey(item.key) && signedUrl
          ? { uri: signedUrl, cacheKey: item.key }
          : undefined;
      const kind = isVideo ? "video" : isImageKey(item.key) ? "image" : "file";

      return (
        <MediaTile
          id={item.key}
          kind={kind}
          source={source}
          size={size}
          title={filename}
          subtitle={`${formatBytes(item.size)} • ${formatDate(item.lastModified)}`}
          selected={selectedKeys.has(item.key)}
          // A tile opens the viewer only once it has a signed URL to show.
          onPress={signedUrl && kind !== "file" ? handleOpenViewer : undefined}
          onToggleSelect={toggleSelectedKey}
          onDelete={handleDelete}
          disabled={isDeleteBusy}
          deleteIcon="trash"
          fallbackIcon={isVideo ? "video" : "file"}
        />
      );
    },
    [
      signedUrlData,
      thumbnailUrlData,
      thumbnailKeyByVideo,
      selectedKeys,
      isDeleteBusy,
      toggleSelectedKey,
      handleOpenViewer,
      handleDelete,
    ]
  );

  return (
    <View style={styles.container}>
      <Seo title="Media - Expo Template" description="Upload, compress, and manage photos and videos with cloud storage." />
      <View style={styles.column}>
        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {MEDIA_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[
                styles.filterTab,
                filter === f.key && styles.filterTabActive,
              ]}
              onPress={() => {
                setFilter(f.key);
                clearSelection();
              }}
            >
              <SansSerifText
                size="sm"
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
              >
                {f.label}
              </SansSerifText>
            </Pressable>
          ))}
        </View>

        {/* Summary + actions: a flat row on the gutter, no panel around it */}
        <View style={styles.summaryRow}>
          <View style={styles.stat}>
            <SansSerifBoldText size="lg" style={styles.statValue}>
              {data?.totalCount ?? 0}
            </SansSerifBoldText>
            <SansSerifText size="sm" style={styles.statLabel}>Files</SansSerifText>
          </View>
          <View style={styles.stat}>
            <SansSerifBoldText size="lg" style={styles.statValue}>
              {formatBytes(mediaItems.reduce((sum, i) => sum + i.size, 0))}
            </SansSerifBoldText>
            <SansSerifText size="sm" style={styles.statLabel}>Total Size</SansSerifText>
          </View>
          <View style={styles.summaryActions}>
            <IconButton
              icon="refresh-cw"
              accessibilityLabel="Refresh media"
              preset="ghost"
              size="sm"
              onPress={() => refetch()}
            />
            <IconButton
              icon="upload"
              accessibilityLabel="Upload media"
              preset="default"
              size="sm"
              onPress={handleUpload}
              disabled={uploadDisabled}
            />
          </View>
        </View>

        {/* Videos without a thumbnail: one flat action on the gutter. */}
        {backfill.running || backfillInputs.length > 0 ? (
          <View style={styles.backfillRow}>
            <Button
              preset="outline"
              size="sm"
              testID="media-backfill-thumbnails"
              text={
                backfill.running
                  ? `Creating thumbnails ${backfill.progress.done + backfill.progress.failed}/${backfill.progress.total}`
                  : backfillInputs.length === 1
                    ? "Create 1 missing thumbnail"
                    : `Create ${backfillInputs.length} missing thumbnails`
              }
              loading={backfill.running}
              disabled={backfill.running}
              onPress={() => backfill.run(backfillInputs)}
            />
          </View>
        ) : null}

        {/* Files being processed and uploaded, and any that failed. `Item`
            rows carry the 16 pt inset themselves. */}
        <UploadQueue
          title="Uploads"
          entries={queue.items}
          onRetry={queue.retry}
          onRemove={queue.remove}
          kindIcons={QUEUE_KIND_ICONS}
          maxVisible={MAX_VISIBLE_UPLOADS}
          style={styles.uploadQueue}
          testID="media-upload-queue"
        />
      </View>

      {/* File List */}
      {mediaDisabled ? (
        <View style={styles.emptyContainer} testID="media-disabled">
          <Icon name="cloud-off" size={48} color={theme.colors.mutedForeground} />
          <SansSerifText size="body" style={styles.emptyText}>Media storage not configured</SansSerifText>
          <SansSerifText size="base" style={styles.emptySubtext}>
            Set the R2/S3 env vars in .env to enable uploads, listing, and signed URLs.
          </SansSerifText>
          {missingEnvVars && missingEnvVars.length > 0 && (
            <MonoText size="sm" style={styles.disabledMissing}>
              Missing: {missingEnvVars.join(", ")}
            </MonoText>
          )}
        </View>
      ) : mediaAccessError ? (
        <View style={styles.emptyContainer} testID="media-auth-required">
          <Icon name="lock" size={48} color={theme.colors.mutedForeground} />
          <SansSerifText size="body" style={styles.emptyText}>
            {mediaAccessError.problem.kind === "unauthorized"
              ? "Sign in to access media"
              : "Media access denied"}
          </SansSerifText>
          <SansSerifText size="base" style={styles.emptySubtext}>
            {mediaAccessError.message}
          </SansSerifText>
          <Button
            preset="default"
            size="sm"
            text="Retry"
            style={styles.retryButton}
            onPress={() => refetch()}
          />
        </View>
      ) : fetchError ? (
        <View style={styles.emptyContainer} testID="media-error">
          <Icon name="triangle-alert" size={48} color={theme.colors.destructive} />
          <SansSerifText size="body" style={styles.emptyText}>Couldn&apos;t load media</SansSerifText>
          <SansSerifText size="base" style={styles.emptySubtext}>
            {fetchError instanceof Error ? fetchError.message : "Try again in a moment."}
          </SansSerifText>
          <Button
            preset="default"
            size="sm"
            text="Retry"
            style={styles.retryButton}
            onPress={() => refetch()}
          />
        </View>
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : mediaItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon
            name="folder"
            size={48}
            color={theme.colors.mutedForeground}
          />
          <SansSerifText size="body" style={styles.emptyText}>No files found</SansSerifText>
          <SansSerifText size="base" style={styles.emptySubtext}>
            Upload some media to see it here
          </SansSerifText>
        </View>
      ) : (
        <>
          <View style={styles.column}>
            <MediaSelectionBar
              selectedCount={selection.count}
              totalCount={visibleKeys.length}
              onToggleAll={selection.toggleAll}
              onClear={clearSelection}
              onDelete={handleDeleteSelected}
              busy={isDeleteBusy}
              deleting={isDeletingBatch}
              deleteIcon="trash"
              totalSummary={(count) => `${count} visible`}
            />
          </View>

          <MediaGrid
            data={mediaItems}
            keyExtractor={(item) => item.key}
            renderTile={renderMediaItem}
            maxWidth={MAX_CONTENT_WIDTH}
            refreshControl={refreshControl}
            extraData={selectedKeys}
            style={styles.list}
          />
        </>
      )}

      {/* One viewer over every image and video in the list. */}
      <LazyMediaViewer
        items={viewer?.items ?? NO_VIEWER_ITEMS}
        visible={viewer?.open ?? false}
        initialIndex={viewer?.start ?? 0}
        onClose={handleCloseViewer}
        autoPlay
      />
    </View>
  );
}

function formatDate(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    filterTab: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
    },
    filterTabActive: {
      backgroundColor: theme.colors.primary,
    },
    filterText: {
      color: theme.colors.mutedForeground,
    },
    filterTextActive: {
      color: theme.colors.primaryForeground,
    },
    // The header rows sit in the same capped column as the grid.
    column: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.sm,
    },
    // Each `sm` IconButton's hit slop reaches 8 pt past its edge, so the two
    // need a 16 pt gap for their hit areas not to overlap.
    summaryActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    stat: {
      flex: 1,
    },
    statValue: {
      color: theme.colors.foreground,
    },
    statLabel: {
      color: theme.colors.mutedForeground,
    },
    backfillRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.sm,
    },
    uploadQueue: {
      paddingTop: spacing.sm,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    emptyText: {
      color: theme.colors.foreground,
      marginTop: spacing.md,
    },
    emptySubtext: {
      color: theme.colors.mutedForeground,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    disabledMissing: {
      color: theme.colors.mutedForeground,
      marginTop: spacing.sm,
      textAlign: "center",
    },
    // Button pins itself to flex-start unless the style override supplies
    // alignSelf, so the parent's alignItems: "center" alone won't center it.
    retryButton: {
      alignSelf: "center",
    },
    list: {
      flex: 1,
    },
  });

const themedStyles = createThemedStyles(createStyles);
