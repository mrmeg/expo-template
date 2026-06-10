import { memo, useCallback, useMemo, useReducer, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import {
  SansSerifText,
  SansSerifBoldText,
} from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Checkbox } from "@mrmeg/expo-ui/components/Checkbox";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { ImagePreview } from "@/client/features/media/components/ImagePreview";
import { VideoPlayer } from "@/client/features/media/components/VideoPlayer";
import { useMediaList, formatBytes } from "@/client/features/media/hooks/useMediaList";
import type { MediaItem } from "@mrmeg/expo-media/client";
import { useSignedUrls } from "@/client/features/media/hooks/useSignedUrls";
import {
  useMediaDelete,
  useMediaDeleteBatch,
} from "@/client/features/media/hooks/useMediaDelete";
import { useMediaUpload } from "@/client/features/media/hooks/useMediaUpload";
import {
  useMediaLibrary,
  type ProcessedAsset,
} from "@/client/features/media/hooks/useMediaLibrary";
import { isMediaError } from "@/client/features/media/lib/problem";
import {
  MEDIA_PATHS,
  isVideoKey,
  isImageKey,
  getVideoThumbnailKey,
} from "@/shared/media";
import {
  MEDIA_APP_SETTINGS,
  resolveMediaUploadPolicy,
} from "@/client/features/media/mediaSettings";
import { notify } from "@mrmeg/expo-ui/state";
import { logDev } from "@/client/lib/devtools";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { Seo } from "@/client/components/Seo";

type FilterType = "all" | keyof typeof MEDIA_PATHS;
type MediaType = keyof typeof MEDIA_PATHS;
type MediaViewerState =
  | { type: "video"; url: string; title: string }
  | { type: "image"; url: string; title: string }
  | null;

type MediaViewerAction =
  | { type: "playVideo"; url: string; title: string }
  | { type: "previewImage"; url: string; title: string }
  | { type: "close" };

const LIST_MEDIA_TYPES = [
  "avatars",
  "videos",
  "thumbnails",
  "uploads",
] as const satisfies readonly MediaType[];

const MEDIA_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "avatars", label: "Avatars" },
  { key: "videos", label: "Videos" },
  { key: "uploads", label: "Uploads" },
];

function getDeletePayloadKeys(keys: string[]) {
  const payload = new Set<string>();

  for (const key of keys) {
    payload.add(key);
    if (
      MEDIA_APP_SETTINGS.uploads.deleteVideoThumbnailWithVideo &&
      isVideoKey(key)
    ) {
      payload.add(getVideoThumbnailKey(key));
    }
  }

  return [...payload];
}

function mediaViewerReducer(
  state: MediaViewerState,
  action: MediaViewerAction
): MediaViewerState {
  switch (action.type) {
  case "playVideo":
    return { type: "video", url: action.url, title: action.title };
  case "previewImage":
    return { type: "image", url: action.url, title: action.title };
  case "close":
    return null;
  }
}

export default function MediaScreen() {
  return useMediaScreenContent();
}

function useMediaScreenContent() {
  const { theme, getShadowStyle } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [selectedKeyCandidates, setSelectedKeyCandidates] = useState<Set<string>>(
    () => new Set()
  );
  const [mediaViewer, dispatchMediaViewer] = useReducer(
    mediaViewerReducer,
    null
  );

  const mediaListQueries = {
    avatars: useMediaList({
      mediaType: "avatars",
      enabled: filter === "all" || filter === "avatars",
    }),
    videos: useMediaList({
      mediaType: "videos",
      enabled: filter === "all" || filter === "videos",
    }),
    thumbnails: useMediaList({
      mediaType: "thumbnails",
      enabled: filter === "all" || filter === "thumbnails",
    }),
    uploads: useMediaList({
      mediaType: "uploads",
      enabled: filter === "all" || filter === "uploads",
    }),
  };
  const avatarsData = mediaListQueries.avatars.data;
  const videosData = mediaListQueries.videos.data;
  const thumbnailsData = mediaListQueries.thumbnails.data;
  const uploadsData = mediaListQueries.uploads.data;
  const activeMediaListQueries = filter === "all"
    ? LIST_MEDIA_TYPES.map((mediaType) => mediaListQueries[mediaType])
    : [mediaListQueries[filter]];
  const data = useMemo(() => {
    if (filter !== "all") {
      switch (filter) {
      case "avatars":
        return avatarsData;
      case "videos":
        return videosData;
      case "thumbnails":
        return thumbnailsData;
      case "uploads":
        return uploadsData;
      }
    }

    const items = [
      ...(avatarsData?.items ?? []),
      ...(videosData?.items ?? []),
      ...(thumbnailsData?.items ?? []),
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
    videosData,
    thumbnailsData,
    uploadsData,
  ]);
  const isLoading = activeMediaListQueries.some((query) => query.isLoading);
  const isRefetching = activeMediaListQueries.some((query) => query.isRefetching);
  const error = activeMediaListQueries.find((query) => query.error)?.error ?? null;

  // activeMediaListQueries is rebuilt every render; stash the latest in a ref so
  // refetch can stay referentially stable (and the memoized RefreshControl with
  // it) without going stale.
  const activeQueriesRef = useRef(activeMediaListQueries);
  activeQueriesRef.current = activeMediaListQueries;
  const refetch = useCallback(() => {
    for (const query of activeQueriesRef.current) {
      void query.refetch();
    }
  }, []);
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
  const { mutateAsync: uploadFile, isPending: isUploading } = useMediaUpload();
  const { pickMedia, processing: isPicking } = useMediaLibrary();
  const mediaItems = useMemo(() => data?.items ?? [], [data?.items]);
  const visibleKeys = useMemo(
    () => mediaItems.map((item) => item.key),
    [mediaItems]
  );
  const visibleKeySet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const selectedKeys = useMemo(() => {
    if (selectedKeyCandidates.size === 0) return selectedKeyCandidates;

    const visibleSelectedKeys = new Set(
      [...selectedKeyCandidates].filter((key) => visibleKeySet.has(key))
    );

    return visibleSelectedKeys.size === selectedKeyCandidates.size
      ? selectedKeyCandidates
      : visibleSelectedKeys;
  }, [selectedKeyCandidates, visibleKeySet]);
  const selectedVisibleCount = useMemo(
    () => visibleKeys.filter((key) => selectedKeys.has(key)).length,
    [selectedKeys, visibleKeys]
  );
  const selectedCount = selectedKeys.size;
  const isDeleteBusy = isDeleting || isDeletingBatch;
  const isAllVisibleSelected =
    visibleKeys.length > 0 && selectedVisibleCount === visibleKeys.length;
  const isPartiallyVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleKeys.length;
  const uploadDisabled =
    mediaDisabled || isPicking || isUploading || isUploadingBatch;

  const clearSelection = () => {
    setSelectedKeyCandidates(new Set());
  };

  const toggleSelectedKey = useCallback((key: string) => {
    setSelectedKeyCandidates((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleSelectAllVisible = () => {
    if (visibleKeys.length === 0) return;

    setSelectedKeyCandidates((current) => {
      const next = new Set(current);

      if (isAllVisibleSelected) {
        for (const key of visibleKeys) next.delete(key);
      } else {
        for (const key of visibleKeys) next.add(key);
      }

      return next;
    });
  };

  const handleDelete = useCallback(async (key: string) => {
    try {
      // If deleting a video, also delete its thumbnail
      if (
        MEDIA_APP_SETTINGS.uploads.deleteVideoThumbnailWithVideo &&
        isVideoKey(key)
      ) {
        const thumbnailKey = getVideoThumbnailKey(key);
        try {
          await deleteFile(thumbnailKey);
          logDev(`Deleted video thumbnail: ${thumbnailKey}`);
        } catch {
          // Thumbnail may not exist, that's OK
        }
      }

      await deleteFile(key);
      setSelectedKeyCandidates((current) => {
        const thumbnailKey =
          MEDIA_APP_SETTINGS.uploads.deleteVideoThumbnailWithVideo &&
          isVideoKey(key)
            ? getVideoThumbnailKey(key)
            : null;

        if (!current.has(key) && !(thumbnailKey && current.has(thumbnailKey))) {
          return current;
        }

        const next = new Set(current);
        next.delete(key);
        if (thumbnailKey) {
          next.delete(thumbnailKey);
        }
        return next;
      });
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
  }, [deleteFile]);

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

  const uploadAsset = async (asset: ProcessedAsset) => {
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");
    const file = asset.blob || asset.uri;
    const uploadPolicy = resolveMediaUploadPolicy(asset, filter);

    const result = await uploadFile({
      file,
      contentType: asset.mimeType || "application/octet-stream",
      mediaType: uploadPolicy.policy.mediaType,
    });

    if (
      isVideo &&
      MEDIA_APP_SETTINGS.uploads.uploadVideoThumbnails &&
      (asset.thumbnailBlob || asset.thumbnailUri)
    ) {
      try {
        const videoFilename = result.key.split("/").pop() || "";
        const thumbnailBasename = videoFilename.replace(/\.[^.]+$/, "");
        const thumbnailFile = asset.thumbnailBlob || asset.thumbnailUri;

        if (thumbnailFile) {
          await uploadFile({
            file: thumbnailFile,
            contentType: "image/jpeg",
            mediaType: "thumbnails",
            customFilename: thumbnailBasename,
          });
          logDev(`Uploaded video thumbnail: ${thumbnailBasename}.jpg`);
        }
      } catch (thumbnailError) {
        logDev(`Failed to upload thumbnail: ${thumbnailError}`);
      }
    }

    return { isVideo };
  };

  const handleUpload = async () => {
    setIsUploadingBatch(true);

    try {
      // The picker processes images before per-asset upload resolution. Use
      // the default image policy here; videos ignore image compression.
      const assets = await pickMedia({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: MEDIA_APP_SETTINGS.uploads.selectionLimit,
        compression: MEDIA_APP_SETTINGS.uploadPolicies.generalImage.compression,
      });
      if (!assets || assets.length === 0) return;

      notify.loading(assets.length > 1 ? `Uploading ${assets.length} files` : "Uploading", {
        messages: [
          assets.length > 1
            ? "Uploading selected files"
            : assets[0]?.fileName || "Uploading file",
        ],
      });

      const uploadResults = await Promise.all(
        assets.map(async (asset, index) => {
          try {
            const uploaded = await uploadAsset(asset);
            return { ok: true as const, uploaded };
          } catch (assetError) {
            const fileName = asset.fileName || `File ${index + 1}`;
            logDev(`Failed to upload ${fileName}: ${assetError}`);
            return { ok: false as const, fileName };
          }
        })
      );

      const uploadedCount = uploadResults.filter((result) => result.ok).length;
      const videoCount = uploadResults.filter(
        (result) => result.ok && result.uploaded.isVideo
      ).length;
      const failedFiles = uploadResults.flatMap((result) =>
        result.ok ? [] : [result.fileName]
      );

      notify.hide();

      if (uploadedCount > 0) {
        refetch();
      }

      if (uploadedCount === 0) {
        notify.error("Upload Failed", {
          messages: ["No files were uploaded"],
          duration: 5000,
        });
        return;
      }

      const successMessage =
        uploadedCount === 1
          ? videoCount === 1
            ? "Video uploaded successfully"
            : "File uploaded successfully"
          : `${uploadedCount} files uploaded successfully`;
      const toastMessages =
        failedFiles.length > 0
          ? [
            `${uploadedCount} of ${assets.length} files uploaded`,
            `Failed: ${failedFiles.join(", ")}`,
          ]
          : [successMessage];

      notify({
        type: failedFiles.length > 0 ? "warning" : "success",
        title: failedFiles.length > 0 ? "Upload Incomplete" : "Uploaded",
        messages: toastMessages,
        duration: failedFiles.length > 0 ? 6000 : 3000,
      });
    } catch (error) {
      notify.hide();
      notify.error("Upload Failed", {
        messages: [
          error instanceof Error ? error.message : "Failed to upload file",
        ],
        duration: 5000,
      });
    } finally {
      setIsUploadingBatch(false);
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
    enabled: mediaKeys.length > 0,
  });

  // Get signed URLs for video thumbnails. flatMap filters videos, derives the
  // thumbnail name, and drops any empty result in a single pass.
  const videoKeys =
    data?.items.flatMap((item) => {
      if (!isVideoKey(item.key)) return [];
      const filename = item.key.split("/").pop() || "";
      const thumbnailKey = filename.replace(/\.[^.]+$/, ".jpg");
      return thumbnailKey ? [thumbnailKey] : [];
    }) ?? [];

  const { data: thumbnailUrlData } = useSignedUrls({
    mediaKeys: videoKeys,
    path: MEDIA_PATHS.thumbnails,
    enabled: videoKeys.length > 0,
  });

  const handlePlayVideo = useCallback((filename: string, signedUrl: string) => {
    dispatchMediaViewer({ type: "playVideo", url: signedUrl, title: filename });
  }, []);

  const handlePreviewImage = useCallback((filename: string, signedUrl: string) => {
    dispatchMediaViewer({
      type: "previewImage",
      url: signedUrl,
      title: filename,
    });
  }, []);

  const shadowStyle = useMemo(() => getShadowStyle("subtle"), [getShadowStyle]);

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

  // Stable renderItem so FlatList can window properly; MediaRow is memoized and
  // receives only primitives + stable callbacks, so untouched rows skip
  // re-rendering when selection or sibling rows change.
  const renderMediaItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const isVideo = isVideoKey(item.key);
      const signedUrl = signedUrlData?.urls?.[item.key];
      const thumbnailFilename = isVideo
        ? (item.key.split("/").pop() || item.key).replace(/\.[^.]+$/, ".jpg")
        : null;
      const thumbnailUrl = thumbnailFilename
        ? thumbnailUrlData?.urls?.[thumbnailFilename]
        : null;

      return (
        <MediaRow
          itemKey={item.key}
          size={item.size}
          lastModified={item.lastModified}
          isSelected={selectedKeys.has(item.key)}
          signedUrl={signedUrl}
          thumbnailUrl={thumbnailUrl}
          isDeleteBusy={isDeleteBusy}
          styles={styles}
          theme={theme}
          shadowStyle={shadowStyle}
          onToggleSelect={toggleSelectedKey}
          onPreviewImage={handlePreviewImage}
          onPlayVideo={handlePlayVideo}
          onDelete={handleDelete}
        />
      );
    },
    [
      signedUrlData,
      thumbnailUrlData,
      selectedKeys,
      isDeleteBusy,
      styles,
      theme,
      shadowStyle,
      toggleSelectedKey,
      handlePreviewImage,
      handlePlayVideo,
      handleDelete,
    ]
  );

  return (
    <View style={styles.container}>
      <Seo title="Media - Expo Template" description="Upload, compress, and manage photos and videos with cloud storage." />
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

      {/* Stats */}
      <View style={[styles.statsRow, getShadowStyle("subtle")]}>
        <View style={styles.stat}>
          <SansSerifBoldText style={styles.statValue}>
            {data?.totalCount ?? 0}
          </SansSerifBoldText>
          <SansSerifText style={styles.statLabel}>Files</SansSerifText>
        </View>
        <View style={styles.stat}>
          <SansSerifBoldText style={styles.statValue}>
            {formatBytes(mediaItems.reduce((sum, i) => sum + i.size, 0))}
          </SansSerifBoldText>
          <SansSerifText style={styles.statLabel}>Total Size</SansSerifText>
        </View>
        <Button preset="ghost" size="sm" onPress={() => refetch()}>
          <Icon name="refresh-cw" size={16} color={theme.colors.primary} />
        </Button>
        <Button
          preset="default"
          size="sm"
          onPress={handleUpload}
          disabled={uploadDisabled}
        >
          <Icon name="upload" size={16} color={theme.colors.primaryForeground} />
        </Button>
      </View>

      {/* File List */}
      {mediaDisabled ? (
        <View style={styles.emptyContainer} testID="media-disabled">
          <Icon name="cloud-off" size={48} color={theme.colors.mutedForeground} />
          <SansSerifText style={styles.emptyText}>Media storage not configured</SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
            Set the R2/S3 env vars in .env to enable uploads, listing, and signed URLs.
          </SansSerifText>
          {missingEnvVars && missingEnvVars.length > 0 && (
            <SansSerifText style={styles.disabledMissing}>
              Missing: {missingEnvVars.join(", ")}
            </SansSerifText>
          )}
        </View>
      ) : mediaAccessError ? (
        <View style={styles.emptyContainer} testID="media-auth-required">
          <Icon name="lock" size={48} color={theme.colors.mutedForeground} />
          <SansSerifText style={styles.emptyText}>
            {mediaAccessError.problem.kind === "unauthorized"
              ? "Sign in to access media"
              : "Media access denied"}
          </SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
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
          <Icon name="alert-triangle" size={48} color={theme.colors.destructive} />
          <SansSerifText style={styles.emptyText}>Couldn&apos;t load media</SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
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
          <SansSerifText style={styles.emptyText}>No files found</SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
            Upload some media to see it here
          </SansSerifText>
        </View>
      ) : (
        <>
          <View style={[styles.selectionToolbar, getShadowStyle("subtle")]}>
            <Checkbox
              checked={isAllVisibleSelected}
              indeterminate={isPartiallyVisibleSelected}
              onCheckedChange={toggleSelectAllVisible}
              disabled={isDeleteBusy}
              label={isAllVisibleSelected ? "Deselect all" : "Select all"}
            />
            <SansSerifText style={styles.selectionSummary}>
              {selectedCount > 0
                ? `${selectedCount} selected`
                : `${visibleKeys.length} visible`}
            </SansSerifText>
            <View style={styles.selectionActions}>
              {selectedCount > 0 && (
                <Button
                  preset="ghost"
                  size="sm"
                  text="Clear"
                  onPress={clearSelection}
                  disabled={isDeleteBusy}
                />
              )}
              <Button
                preset="destructive"
                size="sm"
                text={selectedCount > 0 ? `Delete (${selectedCount})` : "Delete"}
                onPress={handleDeleteSelected}
                disabled={selectedCount === 0 || isDeleteBusy}
                loading={isDeletingBatch}
                LeftAccessory={() => (
                  <Icon
                    name="trash-2"
                    size={14}
                    color={theme.colors.destructiveForeground}
                  />
                )}
              />
            </View>
          </View>

          <FlatList
            data={mediaItems}
            keyExtractor={(item) => item.key}
            refreshControl={refreshControl}
            contentContainerStyle={styles.listContent}
            extraData={selectedKeys}
            style={styles.list}
            renderItem={renderMediaItem}
          />
        </>
      )}

      {/* Video Player Modal */}
      {mediaViewer?.type === "video" && (
        <VideoPlayer
          uri={mediaViewer.url}
          visible
          onClose={() => dispatchMediaViewer({ type: "close" })}
          title={mediaViewer.title}
        />
      )}

      {/* Image Preview Modal */}
      {mediaViewer?.type === "image" && (
        <ImagePreview
          uri={mediaViewer.url}
          visible
          onClose={() => dispatchMediaViewer({ type: "close" })}
          title={mediaViewer.title}
        />
      )}
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

interface MediaRowProps {
  itemKey: string;
  size: number;
  lastModified: string;
  isSelected: boolean;
  signedUrl: string | undefined;
  thumbnailUrl: string | null | undefined;
  isDeleteBusy: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  shadowStyle: ViewStyle;
  onToggleSelect: (key: string) => void;
  onPreviewImage: (filename: string, signedUrl: string) => void;
  onPlayVideo: (filename: string, signedUrl: string) => void;
  onDelete: (key: string) => void;
}

// Memoized row: with primitive props and stable callbacks, untouched rows skip
// re-rendering when selection or sibling rows change, so FlatList windowing pays
// off. Handlers stay inline here but only close over this row's own primitives.
const MediaRow = memo(function MediaRow({
  itemKey,
  size,
  lastModified,
  isSelected,
  signedUrl,
  thumbnailUrl,
  isDeleteBusy,
  styles,
  theme,
  shadowStyle,
  onToggleSelect,
  onPreviewImage,
  onPlayVideo,
  onDelete,
}: MediaRowProps) {
  const filename = itemKey.split("/").pop() || itemKey;
  const isImage = isImageKey(itemKey);
  const isVideo = isVideoKey(itemKey);

  return (
    <View
      style={[
        styles.fileItem,
        isSelected && styles.fileItemSelected,
        shadowStyle,
      ]}
    >
      <View style={styles.itemCheckbox}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(itemKey)}
          disabled={isDeleteBusy}
          accessibilityLabel={`Select ${filename}`}
        />
      </View>

      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {isImage && signedUrl ? (
          <Pressable
            onPress={() => onPreviewImage(filename, signedUrl)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open ${filename}`}
          >
            <Image
              source={{ uri: signedUrl }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          </Pressable>
        ) : isVideo && thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : isVideo ? (
          <View style={styles.videoThumbnail}>
            <Icon name="video" size={24} color={theme.colors.primary} />
          </View>
        ) : (
          <View style={styles.iconContainer}>
            <Icon
              name="file"
              size={24}
              color={theme.colors.mutedForeground}
            />
          </View>
        )}

        {/* Play overlay for videos */}
        {isVideo && signedUrl && (
          <Pressable
            style={styles.playOverlay}
            onPress={() => onPlayVideo(filename, signedUrl)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${filename}`}
          >
            <View style={styles.playButton}>
              <Icon name="play" size={16} color="white" />
            </View>
          </Pressable>
        )}
      </View>

      {/* File info */}
      <View style={styles.fileInfo}>
        <SansSerifText style={styles.fileName} numberOfLines={1}>
          {filename}
        </SansSerifText>
        <SansSerifText style={styles.fileMeta}>
          {formatBytes(size)} • {formatDate(lastModified)}
          {isVideo && " • Video"}
        </SansSerifText>
        <SansSerifText style={styles.filePath} numberOfLines={1}>
          {itemKey}
        </SansSerifText>
      </View>

      {/* Delete button */}
      <Pressable
        style={styles.deleteButton}
        onPress={() => onDelete(itemKey)}
        disabled={isDeleteBusy}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${filename}`}
      >
        <Icon name="trash-2" size={18} color={theme.colors.destructive} />
      </Pressable>
    </View>
  );
});

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
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    filterTextActive: {
      color: theme.colors.primaryForeground,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stat: {
      flex: 1,
    },
    statValue: {
      fontSize: 18,
      color: theme.colors.foreground,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
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
      fontSize: 16,
      color: theme.colors.foreground,
      marginTop: spacing.md,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    disabledMissing: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      fontFamily: "monospace",
      marginTop: spacing.sm,
      textAlign: "center",
    },
    // Button pins itself to flex-start unless the style override supplies
    // alignSelf, so the parent's alignItems: "center" alone won't center it.
    retryButton: {
      alignSelf: "center",
    },
    selectionToolbar: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectionSummary: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    selectionActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    fileItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: spacing.sm,
    },
    fileItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.muted,
    },
    itemCheckbox: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    thumbnailContainer: {
      position: "relative",
      width: 56,
      height: 56,
    },
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
    },
    videoThumbnail: {
      width: 56,
      height: 56,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
    },
    playOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      borderRadius: spacing.radiusSm,
    },
    playButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      paddingLeft: 2, // Offset play icon slightly for visual center
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      fontSize: 14,
      color: theme.colors.foreground,
      fontWeight: "500",
    },
    fileMeta: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginTop: 2,
    },
    filePath: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
      marginTop: 2,
      fontFamily: "monospace",
    },
    deleteButton: {
      padding: spacing.sm,
      borderRadius: spacing.radiusSm,
    },
  });
