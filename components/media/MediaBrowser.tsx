import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, Modal, Platform } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { SansSerifText } from "@/components/ui/StyledText";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

const { width } = Dimensions.get("window");

interface MediaBrowserProps {
  assets: MediaLibrary.Asset[];
  onClose: () => void;
  onOpen?: () => void;
  onAssetDeleted?: (asset: MediaLibrary.Asset) => void;
  hasMediaPermission: boolean;
}

export const MediaBrowser = ({ assets, onClose, onOpen, onAssetDeleted, hasMediaPermission }: MediaBrowserProps) => {
  const { theme } = useTheme();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaLibrary.Asset | null>(null);
  const player = useVideoPlayer(selectedVideo || "", (player) => {
    player.loop = false;
  });

  useEffect(() => {
    onOpen?.();
    return () => {
      // Cleanup if needed
    };
  }, [onOpen]);

  const handleDeleteAsset = useCallback(async (asset: MediaLibrary.Asset) => {
    try {
      console.log("Starting deletion process for asset:", asset.id);
      console.log("Asset details:", JSON.stringify(asset, null, 2));
      
      if (Platform.OS === "android") {
        // On Android, first ensure we have the proper permissions by creating an asset
        console.log("Android: Attempting to create asset for proper permissions...");
        try {
          const newAsset = await MediaLibrary.createAssetAsync(asset.uri);
          console.log("Android: Created asset for permissions:", newAsset.id);
        } catch (createError) {
          console.warn("Android: Couldn't create asset for permissions:", createError);
        }

        // Then try to delete from media library
        console.log("Android: Attempting to delete from media library...");
        const deleteSuccess = await MediaLibrary.deleteAssetsAsync([asset.id]);
        console.log("Android: Delete success:", deleteSuccess);

        if (!deleteSuccess) {
          throw new Error("Failed to delete from media library on Android");
        }
      } else {
        // iOS deletion process
        console.log("Fetching fresh asset info...");
        const freshAsset = await MediaLibrary.getAssetInfoAsync(asset.id);
        console.log("Fresh asset info:", JSON.stringify(freshAsset, null, 2));

        console.log("Attempting to delete from media library...");
        const deleteSuccess = await MediaLibrary.deleteAssetsAsync([asset.id]);
        console.log("Delete success:", deleteSuccess);

        if (!deleteSuccess) {
          throw new Error("Failed to delete from media library");
        }

        // Delete the actual file if we have its path
        if (freshAsset.localUri) {
          try {
            console.log("Attempting to delete local file:", freshAsset.localUri);
            const fileInfo = await FileSystem.getInfoAsync(freshAsset.localUri);
            console.log("Local file info before deletion:", JSON.stringify(fileInfo, null, 2));
            await FileSystem.deleteAsync(freshAsset.localUri, { idempotent: true });
            console.log("Local file deleted successfully");
          } catch (fileError) {
            console.warn("Couldn't delete local file:", fileError);
            console.warn("File error details:", JSON.stringify(fileError, null, 2));
          }
        }
      }

      // Clean up cached files for both platforms
      const cachedPath = `${FileSystem.documentDirectory}${asset.filename || asset.id}`;
      try {
        console.log("Attempting to delete cached file:", cachedPath);
        const cacheInfo = await FileSystem.getInfoAsync(cachedPath);
        console.log("Cached file info before deletion:", JSON.stringify(cacheInfo, null, 2));
        await FileSystem.deleteAsync(cachedPath, { idempotent: true });
        console.log("Cached file deleted successfully");
      } catch (cacheError) {
        console.warn("Couldn't delete cached file:", cacheError);
        console.warn("Cache error details:", JSON.stringify(cacheError, null, 2));
      }

      // Update UI
      console.log("Notifying parent component of deletion");
      onAssetDeleted?.(asset);

      console.log("Showing success alert");
      Alert.show({
        title: "Success",
        message: "Media deleted",
        buttons: [{ text: "OK", style: "default" }]
      });

    } catch (error: any) {
      console.error("Full deletion error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("Error stack:", error.stack);
      Alert.show({
        title: "Error",
        message: "Could not delete media. Please try again.",
        buttons: [{ text: "OK", style: "destructive" }]
      });
    }
  }, [onAssetDeleted]);

  const confirmDelete = useCallback((asset: MediaLibrary.Asset) => {
    if (!hasMediaPermission) {
      Alert.show({
        title: "Permission Required",
        message: "Media library access is required to delete videos.",
        buttons: [{ text: "OK", style: "default" }]
      });
      return;
    }
    
    setAssetToDelete(asset);
  }, [hasMediaPermission]);

  const executeDelete = useCallback(() => {
    if (assetToDelete) {
      handleDeleteAsset(assetToDelete);
      setAssetToDelete(null);
    }
  }, [assetToDelete, handleDeleteAsset]);

  const cancelDelete = useCallback(() => {
    setAssetToDelete(null);
  }, []);

  const handlePlayVideo = useCallback(
    async (asset: MediaLibrary.Asset) => {
      try {
        console.log("Attempting to play video with asset ID:", asset.id);

        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id, {
          shouldDownloadFromNetwork: true,
        });

        let sourceUri: string | null = null;

        if (Platform.OS === "ios") {
          if (!assetInfo.localUri) {
            throw new Error("Could not retrieve localUri for the asset.");
          }
          sourceUri = assetInfo.localUri;
        } else if (Platform.OS === "android") {
          // Android uses assetInfo.uri directly
          sourceUri = assetInfo.uri;
          if (!sourceUri) {
            throw new Error("Could not retrieve URI for the asset on Android.");
          }
        } else {
          throw new Error("Unsupported platform.");
        }

        console.log("sourceUri:", sourceUri);

        const filename = asset.filename || `video-${asset.id}.mp4`;
        const localFileUri = `${FileSystem.documentDirectory}${filename}`;

        // Check if file already exists locally
        const fileExists = await FileSystem.getInfoAsync(localFileUri);
        if (!fileExists.exists) {
          await FileSystem.copyAsync({
            from: sourceUri,
            to: localFileUri,
          });
          console.log("File copied successfully to app storage:", localFileUri);
        } else {
          console.log("File already exists locally:", localFileUri);
        }

        setSelectedVideo(localFileUri);
        player.replace(localFileUri);
        player.play();
      } catch (error) {
        console.error("Error playing video:", error);
        Alert.show({
          title: "Error",
          message: "Could not play video"
        });
      }
    },[player]);

  const handleCloseVideo = useCallback(() => {
    player.pause();
    setSelectedVideo(null);
  }, [player]);

  const handleShareVideo = useCallback(async (uri: string) => {
    try {
      let shareUri = uri;
      if (Platform.OS === "ios") {
        // For sharing on iOS, we still need to get the actual file
        const assetInfo = await MediaLibrary.getAssetInfoAsync(uri, {
          shouldDownloadFromNetwork: true
        });
        if (assetInfo?.localUri) {
          shareUri = assetInfo.localUri;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri);
      } else {
        Alert.show({
          title: "Sharing not available",
          message: "Sharing is not available on this device"
        });
      }
    } catch (error) {
      console.error("Error sharing video:", error);
      Alert.show({
        title: "Error",
        message: "Failed to share video"
      });
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: MediaLibrary.Asset }) => (
    <View style={styles.mediaItemContainer}>
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handlePlayVideo(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.mediaItemImage} />
        <Ionicons
          name="play-circle"
          size={40}
          color="rgba(255,255,255,0.8)"
          style={styles.playIcon}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={() => handleShareVideo(item.uri)}
      >
        <Ionicons name="share-social" size={20} color="white" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
        onPress={() => confirmDelete(item)}
      >
        <Ionicons name="trash" size={20} color="white" />
      </TouchableOpacity>
    </View>
  ), [handlePlayVideo, handleShareVideo, confirmDelete]);

  return (
    <View style={styles.overlay}>
      <Modal
        visible={!!selectedVideo}
        transparent={false}
        animationType="slide"
        onRequestClose={handleCloseVideo}
      >
        <View style={styles.videoContainer}>
          <VideoView
            style={styles.videoPlayer}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
          <View style={styles.videoControls}>
            <TouchableOpacity
              style={styles.videoControlButton}
              onPress={handleCloseVideo}
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.videoControlButton}
              onPress={() => selectedVideo && handleShareVideo(selectedVideo)}
            >
              <Ionicons name="share-social" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!assetToDelete}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationDialog}>
            <SansSerifText style={styles.confirmationTitle}>Delete Video</SansSerifText>
            <SansSerifText style={styles.confirmationMessage}>
              Are you sure you want to delete this video? This action cannot be undone.
            </SansSerifText>
            <View style={styles.confirmationButtons}>
              <Button
                title="Cancel"
                onPress={cancelDelete}
              />
              <Button
                title="Delete"
                onPress={executeDelete}
                style={{ backgroundColor: theme.colors.error }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.content}>
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.list}
        />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <SansSerifText style={styles.closeButtonText}>Close Gallery</SansSerifText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.95)",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "rgba(30,30,30,0.9)",
    borderRadius: 10,
    padding: 15,
  },
  list: {
    paddingBottom: 15,
  },
  mediaItemContainer: {
    position: "relative",
    margin: 5,
  },
  mediaItem: {
    width: (width * 0.9 - 60) / 3,
    height: (width * 0.9 - 60) / 3,
    borderRadius: 5,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaItemImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  playIcon: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  shareButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 15,
    padding: 5,
    zIndex: 10,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  videoControls: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "row",
    gap: 10,
  },
  videoControlButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 10,
  },
  closeButton: {
    alignSelf: "center",
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 5,
    marginTop: 10,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
  },
  buttonContainer: {
    position: "absolute",
    top: 5,
    right: 5,
    flexDirection: "row",
    gap: 5,
    zIndex: 10,
  },
  deleteButton: {
    width: 32,
    borderRadius: 15,
    padding: 5,
  },
  // Confirmation modal styles
  confirmationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmationDialog: {
    width: "80%",
    backgroundColor: "rgba(30,30,30,0.95)",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  confirmationTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  confirmationMessage: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  confirmationButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  confirmationButton: {
    padding: 12,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(100,100,100,0.8)",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
