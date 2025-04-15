import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraType, FlashMode, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import * as VideoThumbnails from "expo-video-thumbnails";
import SDCameraView from "@/components/Camera/CameraView";
import CameraControls from "@/components/Camera/CameraControls";
import TimestampOverlay from "@/components/Camera/TimestampOverlay";
import * as MediaLibrary from "expo-media-library";
import { ScrollView } from "@/components/ui/ScrollView";
import { SansSerifText } from "@/components/ui/StyledText";

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [timestampEnabled, setTimestampEnabled] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [lastRecordedVideo, setLastRecordedVideo] = useState<string | null>(null);
  const [latestVideoThumbnail, setLatestVideoThumbnail] = useState<string | null>(null);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);

  useEffect(() => {
    if (hasMediaPermission) {
      getLatestVideoThumbnail();
    }
  }, [hasMediaPermission]);

  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaPermission(status === "granted");

      // Load initial thumbnail if permission granted
      if (status === "granted") {
        getLatestVideoThumbnail();
      }
    })();
  }, []);

  const getLatestVideoThumbnail = async () => {
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
  };

  const handleRecordPress = async () => {
    if (!cameraPermission?.granted) {
      Alert.alert(
        "Camera Access Required",
        "Please enable camera access to record videos."
      );
      return;
    }

    if (!microphonePermission?.granted) {
      Alert.alert(
        "Microphone Required",
        "Please enable microphone access to record videos with sound."
      );
      return;
    }

    setIsRecording(current => !current);
  };

  // Handle camera flip - toggle between front and back
  const handleFlipPress = () => {
    setCameraType(current =>
      current === "back" ? "front" : "back"
    );
  };

  // Handle flash toggle - cycle between off and on
  const handleFlashPress = () => {
    setFlash(current =>
      current === "off" ? "on" : "off"
    );
  };

  // Handle timestamp toggle
  const handleTimestampToggle = () => {
    setTimestampEnabled(!timestampEnabled);
  };

  // Handle camera ready state
  const handleCameraReady = () => {
    setIsCameraReady(true);
  };

  // Handle recording start callback
  const handleRecordingStart = () => {
    console.log("Recording started");
  };

  const handleThumbnailPress = async () => {
    if (!hasMediaPermission) {
      Alert.alert(
        "Permission Required",
        "Media library access is required to view videos."
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
  };

  const handleRecordingEnd = async (videoUri: string) => {
    console.log("Recording ended:", videoUri);
    setLastRecordedVideo(videoUri);

    if (hasMediaPermission) {
      try {
        // Save video to media library
        const asset = await MediaLibrary.createAssetAsync(videoUri);
        console.log("Video saved to library:", asset);

        // Generate and set new thumbnail from the recorded video
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          quality: 0.8,
          time: 1000
        });
        setLatestVideoThumbnail(uri);

        // Show share option
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
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SDCameraView
        onCameraReady={handleCameraReady}
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

      <CameraControls
        isRecording={isRecording}
        onRecordPress={handleRecordPress}
        onFlipPress={handleFlipPress}
        onFlashPress={handleFlashPress}
        onTimestampToggle={handleTimestampToggle}
        flashEnabled={flash === "on"}
        timestampEnabled={timestampEnabled}
      />

      {latestVideoThumbnail && (
        <TouchableOpacity
          style={styles.mediaPreview}
          onPress={handleThumbnailPress}
        >
          <Image
            source={{ uri: latestVideoThumbnail }}
            style={styles.thumbnail}
          />
        </TouchableOpacity>
      )}

      {showMediaBrowser && (
        <View style={styles.mediaBrowser}>
          <ScrollView horizontal>
            {mediaAssets.map((asset) => (
              <TouchableOpacity
                key={asset.id}
                onPress={() => Sharing.shareAsync(asset.uri)}
              >
                <Image
                  source={{ uri: asset.uri }}
                  style={styles.browserThumbnail}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowMediaBrowser(false)}
          >
            <SansSerifText style={styles.closeButtonText}>Close</SansSerifText>
          </TouchableOpacity>
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
  mediaPreview: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 60,
    height: 80,
    borderRadius: 4,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  mediaBrowser: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 10,
  },
  browserThumbnail: {
    width: 80,
    height: 80,
    marginRight: 10,
  },
  closeButton: {
    alignSelf: "center",
    padding: 10,
  },
  closeButtonText: {
    color: "white",
  }
});
