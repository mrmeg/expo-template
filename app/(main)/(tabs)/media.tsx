import { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
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
import { MEDIA_APP_SETTINGS } from "@/client/features/media/mediaSettings";
import { globalUIStore } from "@mrmeg/expo-ui/state";
import { logDev } from "@/client/lib/devtools";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { SEO } from "@/client/components/SEO";

type FilterType = "all" | keyof typeof MEDIA_PATHS;
type MediaType = keyof typeof MEDIA_PATHS;

const LIST_MEDIA_TYPES = [
  "avatars",
  "videos",
  "thumbnails",
  "uploads",
] as const satisfies readonly MediaType[];

export default function MediaScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [previewingImage, setPreviewingImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

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
  const activeMediaListQueries = filter === "all"
    ? LIST_MEDIA_TYPES.map((mediaType) => mediaListQueries[mediaType])
    : [mediaListQueries[filter]];
  const data = useMemo(() => {
    if (filter !== "all") {
      return mediaListQueries[filter].data;
    }

    const items = LIST_MEDIA_TYPES.flatMap(
      (mediaType) => mediaListQueries[mediaType].data?.items ?? [],
    );

    return {
      items,
      totalCount: items.length,
      nextCursor: undefined,
    };
  }, [
    filter,
    mediaListQueries.avatars.data,
    mediaListQueries.videos.data,
    mediaListQueries.thumbnails.data,
    mediaListQueries.uploads.data,
  ]);
  const isLoading = activeMediaListQueries.some((query) => query.isLoading);
  const isRefetching = activeMediaListQueries.some((query) => query.isRefetching);
  const error = activeMediaListQueries.find((query) => query.error)?.error ?? null;
  const refetch = () => {
    for (const query of activeMediaListQueries) {
      void query.refetch();
    }
  };
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

  useEffect(() => {
    setSelectedKeys((current) => {
      if (current.size === 0) return current;

      const next = new Set(
        [...current].filter((key) => visibleKeySet.has(key))
      );
      return next.size === current.size ? current : next;
    });
  }, [visibleKeySet]);

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const toggleSelectedKey = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (visibleKeys.length === 0) return;

    setSelectedKeys((current) => {
      const next = new Set(current);

      if (isAllVisibleSelected) {
        for (const key of visibleKeys) next.delete(key);
      } else {
        for (const key of visibleKeys) next.add(key);
      }

      return next;
    });
  };

  const getDeletePayloadKeys = (keys: string[]) => {
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
  };

  const handleDelete = async (key: string) => {
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
      setSelectedKeys((current) => {
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
      globalUIStore.getState().show({
        type: "success",
        title: "Deleted",
        messages: ["File deleted successfully"],
        duration: 3000,
      });
    } catch (error) {
      globalUIStore.getState().show({
        type: "error",
        title: "Delete Failed",
        messages: [
          error instanceof Error ? error.message : "Failed to delete file",
        ],
        duration: 5000,
      });
    }
  };

  const handleDeleteSelected = async () => {
    const selectedForDelete = [...selectedKeys];
    if (selectedForDelete.length === 0) return;

    globalUIStore.getState().show({
      type: "info",
      title: "Deleting",
      messages: [
        selectedForDelete.length === 1
          ? "Deleting selected file..."
          : `Deleting ${selectedForDelete.length} selected files...`,
      ],
      loading: true,
    });

    try {
      const payloadKeys = getDeletePayloadKeys(selectedForDelete);
      const result = await deleteFiles(payloadKeys);
      const errorCount = result.errors?.length ?? 0;

      clearSelection();
      globalUIStore.getState().hide();

      if (errorCount > 0) {
        globalUIStore.getState().show({
          type: "warning",
          title: "Delete Incomplete",
          messages: [
            `${selectedForDelete.length} selected files processed`,
            `${errorCount} storage item${errorCount === 1 ? "" : "s"} failed`,
          ],
          duration: 6000,
        });
        return;
      }

      globalUIStore.getState().show({
        type: "success",
        title: "Deleted",
        messages: [
          selectedForDelete.length === 1
            ? "Selected file deleted"
            : `${selectedForDelete.length} selected files deleted`,
        ],
        duration: 3000,
      });
    } catch (error) {
      globalUIStore.getState().hide();
      globalUIStore.getState().show({
        type: "error",
        title: "Delete Failed",
        messages: [
          error instanceof Error ? error.message : "Failed to delete files",
        ],
        duration: 5000,
      });
    }
  };

  const getUploadMediaType = (asset: ProcessedAsset): keyof typeof MEDIA_PATHS => {
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");

    if (filter !== "all" && filter !== "thumbnails") {
      return filter;
    }

    return isVideo
      ? MEDIA_APP_SETTINGS.uploads.defaultVideoMediaType
      : MEDIA_APP_SETTINGS.uploads.defaultImageMediaType;
  };

  const uploadAsset = async (asset: ProcessedAsset) => {
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");
    const file = asset.blob || asset.uri;

    const result = await uploadFile({
      file,
      contentType: asset.mimeType || "application/octet-stream",
      mediaType: getUploadMediaType(asset),
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
      const assets = await pickMedia({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: MEDIA_APP_SETTINGS.uploads.selectionLimit,
      });
      if (!assets || assets.length === 0) return;

      let uploadedCount = 0;
      let videoCount = 0;
      const failedFiles: string[] = [];

      for (const [index, asset] of assets.entries()) {
        globalUIStore.getState().show({
          type: "info",
          title: assets.length > 1 ? `Uploading ${index + 1} of ${assets.length}` : "Uploading",
          messages: [asset.fileName || "Uploading file"],
          loading: true,
        });

        try {
          const uploaded = await uploadAsset(asset);
          uploadedCount += 1;
          if (uploaded.isVideo) videoCount += 1;
        } catch (assetError) {
          const fileName = asset.fileName || `File ${index + 1}`;
          failedFiles.push(fileName);
          logDev(`Failed to upload ${fileName}: ${assetError}`);
        }
      }

      globalUIStore.getState().hide();

      if (uploadedCount > 0) {
        refetch();
      }

      if (uploadedCount === 0) {
        globalUIStore.getState().show({
          type: "error",
          title: "Upload Failed",
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

      globalUIStore.getState().show({
        type: failedFiles.length > 0 ? "warning" : "success",
        title: failedFiles.length > 0 ? "Upload Incomplete" : "Uploaded",
        messages: toastMessages,
        duration: failedFiles.length > 0 ? 6000 : 3000,
      });
    } catch (error) {
      globalUIStore.getState().hide();
      globalUIStore.getState().show({
        type: "error",
        title: "Upload Failed",
        messages: [
          error instanceof Error ? error.message : "Failed to upload file",
        ],
        duration: 5000,
      });
    } finally {
      setIsUploadingBatch(false);
    }
  };

  // Get signed URLs for all media items (images and videos) using full keys
  const mediaKeys =
    data?.items
      .filter((item) => isImageKey(item.key) || isVideoKey(item.key))
      .map((item) => item.key)
      .filter(Boolean) || [];

  const { data: signedUrlData } = useSignedUrls({
    mediaKeys,
    // No path - keys are full paths like "media/videos/abc.mp4"
    enabled: mediaKeys.length > 0,
  });

  // Get signed URLs for video thumbnails
  const videoKeys =
    data?.items
      .filter((item) => isVideoKey(item.key))
      .map((item) => {
        const filename = item.key.split("/").pop() || "";
        return filename.replace(/\.[^.]+$/, ".jpg");
      })
      .filter(Boolean) || [];

  const { data: thumbnailUrlData } = useSignedUrls({
    mediaKeys: videoKeys,
    path: MEDIA_PATHS.thumbnails,
    enabled: videoKeys.length > 0,
  });

  const handlePlayVideo = (filename: string, signedUrl: string) => {
    setPlayingVideo({ url: signedUrl, title: filename });
  };

  const handlePreviewImage = (filename: string, signedUrl: string) => {
    setPreviewingImage({ url: signedUrl, title: filename });
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "avatars", label: "Avatars" },
    { key: "videos", label: "Videos" },
    { key: "uploads", label: "Uploads" },
  ];

  return (
    <View style={styles.container}>
      <SEO title="Media - Expo Template" description="Upload, compress, and manage photos and videos with cloud storage." />
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
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
          <Button preset="default" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      ) : fetchError ? (
        <View style={styles.emptyContainer} testID="media-error">
          <Icon name="alert-triangle" size={48} color={theme.colors.destructive} />
          <SansSerifText style={styles.emptyText}>Couldn&apos;t load media</SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
            {fetchError instanceof Error ? fetchError.message : "Try again in a moment."}
          </SansSerifText>
          <Button preset="default" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
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
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            extraData={selectedKeys}
            style={styles.list}
            renderItem={({ item }) => {
              const filename = item.key.split("/").pop() || item.key;
              const isImage = isImageKey(item.key);
              const isVideo = isVideoKey(item.key);
              const isSelected = selectedKeys.has(item.key);
              // Look up by full key since we pass full paths to getSignedUrls
              const signedUrl = signedUrlData?.urls?.[item.key];

              // Get thumbnail URL for videos
              const thumbnailFilename = isVideo
                ? filename.replace(/\.[^.]+$/, ".jpg")
                : null;
              const thumbnailUrl = thumbnailFilename
                ? thumbnailUrlData?.urls?.[thumbnailFilename]
                : null;

              return (
                <View
                  style={[
                    styles.fileItem,
                    isSelected && styles.fileItemSelected,
                    getShadowStyle("subtle"),
                  ]}
                >
                  <View style={styles.itemCheckbox}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectedKey(item.key)}
                      disabled={isDeleteBusy}
                      accessibilityLabel={`Select ${filename}`}
                    />
                  </View>

                  {/* Thumbnail */}
                  <View style={styles.thumbnailContainer}>
                    {isImage && signedUrl ? (
                      <Pressable
                        onPress={() => handlePreviewImage(filename, signedUrl)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`Open ${filename}`}
                      >
                        <Image
                          source={{ uri: signedUrl }}
                          style={styles.thumbnail}
                          resizeMode="cover"
                        />
                      </Pressable>
                    ) : isVideo && thumbnailUrl ? (
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.thumbnail}
                        resizeMode="cover"
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
                        onPress={() => handlePlayVideo(filename, signedUrl)}
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
                      {formatBytes(item.size)} • {formatDate(item.lastModified)}
                      {isVideo && " • Video"}
                    </SansSerifText>
                    <SansSerifText style={styles.filePath} numberOfLines={1}>
                      {item.key}
                    </SansSerifText>
                  </View>

                  {/* Delete button */}
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.key)}
                    disabled={isDeleteBusy}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${filename}`}
                  >
                    <Icon name="trash-2" size={18} color={theme.colors.destructive} />
                  </Pressable>
                </View>
              );
            }}
          />
        </>
      )}

      {/* Video Player Modal */}
      {playingVideo && (
        <VideoPlayer
          uri={playingVideo.url}
          visible={!!playingVideo}
          onClose={() => setPlayingVideo(null)}
          title={playingVideo.title}
        />
      )}

      {/* Image Preview Modal */}
      {previewingImage && (
        <ImagePreview
          uri={previewingImage.url}
          visible={!!previewingImage}
          onClose={() => setPreviewingImage(null)}
          title={previewingImage.title}
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
      ...StyleSheet.absoluteFillObject,
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
