import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  FlatList,
  Dimensions,
  TouchableWithoutFeedback,
  Linking
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraType, FlashMode, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import * as VideoThumbnails from "expo-video-thumbnails";
import SDCameraView from "@/components/Camera/CameraView";
import TimestampOverlay from "@/components/Camera/TimestampOverlay";
import * as MediaLibrary from "expo-media-library";
import { SansSerifText } from "@/components/ui/StyledText";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [timestampEnabled, setTimestampEnabled] = useState(true);
  const [latestVideoThumbnail, setLatestVideoThumbnail] = useState<string | null>(null);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);

  const getLatestVideoThumbnail = useCallback(async () => {
    if (!hasMediaPermission) return;

    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: "video",
        sortBy: ["creationTime"],
        first: 1
      });

      if (assets.length > 0) {
        const { uri } = await VideoThumbnails.getThumbnailAsync(assets[0].uri, {
          quality: 0.8,
          time: 1000
        });
        setLatestVideoThumbnail(uri);
      }
    } catch (error) {
      console.error("Error getting video thumbnail:", error);
    }
  }, [hasMediaPermission]);

  useEffect(() => {
    if (hasMediaPermission) {
      getLatestVideoThumbnail();
    }
  }, [hasMediaPermission, getLatestVideoThumbnail]);

  useEffect(() => {
    const initPermissions = async () => {
      try {
        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }
        if (!microphonePermission?.granted) {
          await requestMicrophonePermission();
        }

        const mediaResponse = await MediaLibrary.requestPermissionsAsync();
        setHasMediaPermission(mediaResponse.status === "granted");
      } catch (error) {
        console.error("Error initializing permissions:", error);
        Alert.alert("Error", "Failed to initialize camera permissions");
      }
    };

    initPermissions();
  }, []);

  const handleRecordPress = useCallback(async () => {
    if (!cameraPermission?.granted) {
      Alert.alert(
        "Camera Access Required",
        "Please enable camera access to record videos.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return;
    }

    if (!microphonePermission?.granted) {
      Alert.alert(
        "Microphone Required",
        "Please enable microphone access to record videos with sound.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return;
    }

    setIsRecording(current => !current);
  }, [cameraPermission, microphonePermission]);

  const handleFlipPress = useCallback(() => {
    setCameraType(current => current === "back" ? "front" : "back");
  }, []);

  const handleFlashPress = useCallback(() => {
    setFlash(current => current === "off" ? "on" : "off");
  }, []);

  const handleTimestampToggle = useCallback(() => {
    setTimestampEnabled(current => !current);
  }, []);

  const handleRecordingStart = useCallback(() => {
    console.log("Recording started");
  }, []);

  const renderMediaItem = useCallback(({ item }: { item: MediaLibrary.Asset }) => (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => Sharing.shareAsync(item.uri)}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.mediaItemImage}
      />
    </TouchableOpacity>
  ), []);

  const handleThumbnailPress = useCallback(async () => {
    if (!hasMediaPermission) {
      Alert.alert(
        "Permission Required",
        "Media library access is required to view videos.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return;
    }

    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: "video",
        sortBy: ["creationTime"],
      });
      setMediaAssets(assets);
      setShowMediaBrowser(true);
    } catch (error) {
      console.error("Error loading videos:", error);
      Alert.alert("Error", "Could not load videos");
    }
  }, [hasMediaPermission]);

  const handleRecordingEnd = useCallback(async (videoUri: string) => {
    console.log("Recording ended:", videoUri);

    if (hasMediaPermission) {
      try {
        const asset = await MediaLibrary.createAssetAsync(videoUri);
        console.log("Video saved to library:", asset);

        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          quality: 0.8,
          time: 1000
        });
        setLatestVideoThumbnail(uri);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          Alert.alert(
            "Video Recorded",
            "Your retro video has been saved to your library. Do you want to share it?",
            [
              {
                text: "No",
                style: "cancel",
              },
              {
                text: "Share",
                onPress: () => Sharing.shareAsync(videoUri),
              },
            ],
          );
        }
      } catch (error) {
        console.error("Error saving video:", error);
        Alert.alert(
          "Error",
          "There was an error saving your video."
        );
      }
    }
  }, [hasMediaPermission]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SDCameraView
        onRecordingStart={handleRecordingStart}
        onRecordingEnd={handleRecordingEnd}
        isRecording={isRecording}
        cameraType={cameraType}
        flash={flash}
      />

      <TimestampOverlay
        enabled={timestampEnabled}
        position="topRight"
      />

      {/* Media Library Button - Bottom Left */}
      <TouchableOpacity
        style={styles.mediaLibraryButton}
        onPress={handleThumbnailPress}
      >
        {latestVideoThumbnail ? (
          <Image source={{ uri: latestVideoThumbnail }} style={styles.mediaPreview} />
        ) : (
          <Ionicons name="images" size={24} color="white" />
        )}
      </TouchableOpacity>

      {/* Secondary Controls - Right Side */}
      <View style={styles.secondaryControls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleFlipPress}>
          <Ionicons name="camera-reverse" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleFlashPress}>
          <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleTimestampToggle}>
          <Ionicons name={timestampEnabled ? "time" : "time-outline"} size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Record Button - Bottom Center */}
      <View style={styles.recordButtonContainer}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingButton]}
          onPress={handleRecordPress}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Media Browser Overlay */}
      {showMediaBrowser && (
        <View style={styles.mediaBrowserOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowMediaBrowser(false)}>
            <View style={styles.mediaBrowserContent}>
              <FlatList
                data={mediaAssets}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.mediaBrowserList}
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowMediaBrowser(false)}
              >
                <SansSerifText style={styles.closeButtonText}>Close</SansSerifText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mediaLibraryButton: {
    position: "absolute",
    bottom: 30,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    zIndex: 10,
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  secondaryControls: {
    position: "absolute",
    bottom: 40,
    right: 20,
    justifyContent: "space-between",
    height: 180,
    zIndex: 10,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  recordButtonContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "white",
    backgroundColor: "rgba(255,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingButton: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderColor: "transparent",
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: "white",
    borderRadius: 3,
  },
  mediaBrowserOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaBrowserContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "rgba(30,30,30,0.9)",
    borderRadius: 10,
    padding: 15,
  },
  mediaBrowserList: {
    paddingBottom: 15,
  },
  mediaItem: {
    width: (width * 0.9 - 60) / 3,
    height: (width * 0.9 - 60) / 3,
    margin: 5,
    borderRadius: 5,
    overflow: "hidden",
  },
  mediaItemImage: {
    width: "100%",
    height: "100%",
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
