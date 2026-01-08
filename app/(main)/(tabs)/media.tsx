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
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import {
  SansSerifText,
  SansSerifBoldText,
} from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { FolderOpen, Image as ImageIcon, File, RefreshCw, Trash2, Upload } from "lucide-react-native";
import { useMediaList, formatBytes } from "@/client/hooks/useMediaList";
import { useSignedUrls } from "@/client/hooks/useSignedUrls";
import { useMediaDelete } from "@/client/hooks/useMediaDelete";
import { useMediaUpload } from "@/client/hooks/useMediaUpload";
import { useMediaLibrary } from "@/client/hooks/useMediaLibrary";
import { MEDIA_PATHS } from "@/shared/media";
import { globalUIStore } from "@/client/stores/globalUIStore";
import type { Theme } from "@/client/constants/colors";

type FilterType = "all" | keyof typeof MEDIA_PATHS;

export default function MediaScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);
  const [filter, setFilter] = useState<FilterType>("all");

  const prefix = filter === "all" ? "" : MEDIA_PATHS[filter];
  const { data, isLoading, refetch, isRefetching } = useMediaList({ prefix });
  const { mutateAsync: deleteFile, isPending: isDeleting } = useMediaDelete();
  const { mutateAsync: uploadFile, isPending: isUploading } = useMediaUpload();
  const { pickMedia, processing: isPicking } = useMediaLibrary();

  const handleDelete = async (key: string) => {
    try {
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
        messages: [error instanceof Error ? error.message : "Failed to delete file"],
        duration: 5000,
      });
    }
  };

  const handleUpload = async () => {
    const assets = await pickMedia({ mediaTypes: ["images"] });
    if (!assets || assets.length === 0) return;

    const asset = assets[0];
    const mediaType = filter === "all" ? "uploads" : filter;

    try {
      await uploadFile({
        file: asset.blob!,
        contentType: asset.mimeType || "image/jpeg",
        mediaType,
      });
      globalUIStore.getState().show({
        type: "success",
        title: "Uploaded",
        messages: ["File uploaded successfully"],
        duration: 3000,
      });
      refetch();
    } catch (error) {
      globalUIStore.getState().show({
        type: "error",
        title: "Upload Failed",
        messages: [error instanceof Error ? error.message : "Failed to upload file"],
        duration: 5000,
      });
    }
  };

  // Get signed URLs for all items to display previews
  const imageKeys = data?.items
    .filter((item) => isImageFile(item.key))
    .map((item) => item.key.split("/").pop()!)
    .filter(Boolean) || [];

  const imagePath = data?.items[0]?.key.split("/").slice(0, -1).join("/") || "";

  const { data: signedUrlData } = useSignedUrls({
    mediaKeys: imageKeys,
    path: imagePath,
    enabled: imageKeys.length > 0,
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "avatars", label: "Avatars" },
    { key: "products", label: "Products" },
    { key: "thumbnails", label: "Thumbnails" },
    { key: "uploads", label: "Uploads" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
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
          <Icon as={FolderOpen} size={48} color={theme.colors.mutedForeground} />
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
            const isImage = isImageFile(item.key);
            const signedUrl = signedUrlData?.urls?.[filename];

            return (
              <View style={[styles.fileItem, getShadowStyle("subtle")]}>
                {isImage && signedUrl ? (
                  <Image
                    source={{ uri: signedUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.iconContainer}>
                    <Icon
                      as={isImage ? ImageIcon : File}
                      size={24}
                      color={theme.colors.mutedForeground}
                    />
                  </View>
                )}
                <View style={styles.fileInfo}>
                  <SansSerifText style={styles.fileName} numberOfLines={1}>
                    {filename}
                  </SansSerifText>
                  <SansSerifText style={styles.fileMeta}>
                    {formatBytes(item.size)} • {formatDate(item.lastModified)}
                  </SansSerifText>
                  <SansSerifText style={styles.filePath} numberOfLines={1}>
                    {item.key}
                  </SansSerifText>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item.key)}
                  disabled={isDeleting}
                >
                  <Icon as={Trash2} size={18} color={theme.colors.destructive} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function isImageFile(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
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
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
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
