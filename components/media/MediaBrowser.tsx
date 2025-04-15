import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, Modal, Alert } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { SansSerifText } from "@/components/ui/StyledText";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface MediaBrowserProps {
  assets: MediaLibrary.Asset[];
  onClose: () => void;
  onOpen?: () => void;
}

export default function MediaBrowser({ assets, onClose, onOpen }: MediaBrowserProps) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const player = useVideoPlayer(selectedVideo || "", (player) => {
    player.loop = false;
  });

  useEffect(() => {
    onOpen?.();
    return () => {
      // Cleanup if needed
    };
  }, [onOpen]);

  const handlePlayVideo = useCallback((uri: string) => {
    setSelectedVideo(uri);
    player.replace(uri);
    player.play();
  }, [player]);

  const handleCloseVideo = useCallback(() => {
    player.pause();
    setSelectedVideo(null);
  }, [player]);

  const handleShareVideo = useCallback(async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Sharing not available", "Sharing is not available on this device");
      }
    } catch (error) {
      console.error("Error sharing video:", error);
      Alert.alert("Error", "Failed to share video");
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: MediaLibrary.Asset }) => (
    <View style={styles.mediaItemContainer}>
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handlePlayVideo(item.uri)}
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
    </View>
  ), [handlePlayVideo, handleShareVideo]);

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
}

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
});
