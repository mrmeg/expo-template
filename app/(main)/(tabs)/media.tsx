import { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import {
  SansSerifText,
  SansSerifBoldText,
} from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { VideoPlayer } from "@/client/components/VideoPlayer";
import {
  FolderOpen,
  File,
  RefreshCw,
  Trash2,
  Upload,
  Play,
  Video,
} from "lucide-react-native";
import { useMediaList, formatBytes } from "@/client/hooks/useMediaList";
import { useSignedUrls } from "@/client/hooks/useSignedUrls";
import { useMediaDelete } from "@/client/hooks/useMediaDelete";
import { useMediaUpload } from "@/client/hooks/useMediaUpload";
import { useMediaLibrary } from "@/client/hooks/useMediaLibrary";
import {
  MEDIA_PATHS,
  isVideoKey,
  isImageKey,
  getVideoThumbnailKey,
} from "@/shared/media";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { logDev } from "@/client/devtools";
import type { Theme } from "@/client/constants/colors";

type FilterType = "all" | keyof typeof MEDIA_PATHS;

export default function MediaScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);
  const [filter, setFilter] = useState<FilterType>("all");
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const prefix = filter === "all" ? "" : MEDIA_PATHS[filter];
  const { data, isLoading, refetch, isRefetching } = useMediaList({ prefix });
  const { mutateAsync: deleteFile, isPending: isDeleting } = useMediaDelete();
  const { mutateAsync: uploadFile, isPending: isUploading } = useMediaUpload();
  const { pickMedia, processing: isPicking } = useMediaLibrary();

  const handleDelete = async (key: string) => {
    try {
      // If deleting a video, also delete its thumbnail
      if (isVideoKey(key)) {
        const thumbnailKey = getVideoThumbnailKey(key);
        try {
          await deleteFile(thumbnailKey);
          logDev(`Deleted video thumbnail: ${thumbnailKey}`);
        } catch {
          // Thumbnail may not exist, that's OK
        }
      }

      await deleteFile(key);
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

  const handleUpload = async () => {
    // Allow both images and videos
    const assets = await pickMedia({ mediaTypes: ["images", "videos"] });
    if (!assets || assets.length === 0) return;

    const asset = assets[0];
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");

    // Determine media type based on content and filter
    let mediaType: keyof typeof MEDIA_PATHS;
    if (filter !== "all" && filter !== "thumbnails") {
      mediaType = filter;
    } else if (isVideo) {
      mediaType = "videos";
    } else {
      mediaType = "uploads";
    }

    // Pass blob on web, URI on native
    const file = asset.blob || asset.uri;

    try {
      // Upload the main file
      const result = await uploadFile({
        file,
        contentType: asset.mimeType || "application/octet-stream",
        mediaType,
      });

      // If it's a video with a thumbnail, upload the thumbnail too
      if (isVideo && (asset.thumbnailBlob || asset.thumbnailUri)) {
        try {
          // Derive thumbnail filename from video key (e.g., "01ABC123.mp4" -> "01ABC123")
          const videoFilename = result.key.split("/").pop() || "";
          const thumbnailBasename = videoFilename.replace(/\.[^.]+$/, "");

          // Upload thumbnail - on web we have the blob, on native we need the URI
          const thumbnailFile = asset.thumbnailBlob || asset.thumbnailUri;
          if (thumbnailFile) {
            await uploadFile({
              file: thumbnailFile,
              contentType: "image/jpeg",
              mediaType: "thumbnails",
              customFilename: thumbnailBasename, // Use video's ULID as thumbnail name
            });
            logDev(`Uploaded video thumbnail: ${thumbnailBasename}.jpg`);
          }
        } catch (thumbnailError) {
          logDev(`Failed to upload thumbnail: ${thumbnailError}`);
          // Don't fail the whole upload if thumbnail fails
        }
      }

      globalUIStore.getState().show({
        type: "success",
        title: "Uploaded",
        messages: [isVideo ? "Video uploaded successfully" : "File uploaded successfully"],
        duration: 3000,
      });
      refetch();
    } catch (error) {
      globalUIStore.getState().show({
        type: "error",
        title: "Upload Failed",
        messages: [
          error instanceof Error ? error.message : "Failed to upload file",
        ],
        duration: 5000,
      });
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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "avatars", label: "Avatars" },
    { key: "videos", label: "Videos" },
    { key: "uploads", label: "Uploads" },
  ];

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(f.key)}
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
            {formatBytes(data?.items.reduce((sum, i) => sum + i.size, 0) ?? 0)}
          </SansSerifBoldText>
          <SansSerifText style={styles.statLabel}>Total Size</SansSerifText>
        </View>
        <Button preset="ghost" size="sm" onPress={() => refetch()}>
          <Icon as={RefreshCw} size={16} color={theme.colors.primary} />
        </Button>
        <Button
          preset="default"
          size="sm"
          onPress={handleUpload}
          disabled={isPicking || isUploading}
        >
          <Icon as={Upload} size={16} color={theme.colors.primaryForeground} />
        </Button>
      </View>

      {/* File List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : data?.items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon
            as={FolderOpen}
            size={48}
            color={theme.colors.mutedForeground}
          />
          <SansSerifText style={styles.emptyText}>No files found</SansSerifText>
          <SansSerifText style={styles.emptySubtext}>
            Upload some media to see it here
          </SansSerifText>
        </View>
      ) : (
        <FlatList
          data={data?.items}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const filename = item.key.split("/").pop() || item.key;
            const isImage = isImageKey(item.key);
            const isVideo = isVideoKey(item.key);
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
              <Pressable
                style={[styles.fileItem, getShadowStyle("subtle")]}
                onPress={() => {
                  if (isVideo && signedUrl) {
                    handlePlayVideo(filename, signedUrl);
                  }
                }}
                disabled={!isVideo || !signedUrl}
              >
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                  {isImage && signedUrl ? (
                    <Image
                      source={{ uri: signedUrl }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : isVideo && thumbnailUrl ? (
                    <Image
                      source={{ uri: thumbnailUrl }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : isVideo ? (
                    <View style={styles.videoThumbnail}>
                      <Icon as={Video} size={24} color={theme.colors.primary} />
                    </View>
                  ) : (
                    <View style={styles.iconContainer}>
                      <Icon
                        as={File}
                        size={24}
                        color={theme.colors.mutedForeground}
                      />
                    </View>
                  )}

                  {/* Play overlay for videos */}
                  {isVideo && signedUrl && (
                    <View style={styles.playOverlay}>
                      <View style={styles.playButton}>
                        <Icon as={Play} size={16} color="white" />
                      </View>
                    </View>
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
                  disabled={isDeleting}
                >
                  <Icon as={Trash2} size={18} color={theme.colors.destructive} />
                </Pressable>
              </Pressable>
            );
          }}
        />
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
