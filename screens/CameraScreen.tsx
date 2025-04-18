import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  Linking
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { Camera } from "react-native-vision-camera";

import SDCameraView from "@/components/media/CameraView";
import TimestampOverlay from "@/components/media/TimestampOverlay";
import MediaBrowser from "@/components/media/MediaBrowser";

const { width } = Dimensions.get("window");

export default function CameraScreen() {
  const [cameraPermission, setCameraPermission] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
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
      console.log("Error getting video thumbnail:", error);
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
        const camStatus = await Camera.requestCameraPermission();
        const micStatus = await Camera.requestMicrophonePermission();
        const mediaStatus = await MediaLibrary.requestPermissionsAsync();

        setCameraPermission(camStatus === "granted");
        setMicrophonePermission(micStatus === "granted");
        setHasMediaPermission(mediaStatus.status === "granted");
      } catch (error) {
        console.error("Error initializing permissions:", error);
        Alert.alert("Error", "Failed to initialize camera permissions");
      }
    };

    initPermissions();
  }, []);

  const handleRecordPress = useCallback(() => {
    if (!cameraPermission) {
      Alert.alert("Camera Access Required", "Please enable camera access to record videos.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]);
      return;
    }

    if (!microphonePermission) {
      Alert.alert("Microphone Required", "Please enable microphone access to record videos with sound.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]);
      return;
    }

    setIsRecording(current => !current);
  }, [cameraPermission, microphonePermission]);

  const handleFlipPress = () => {
    setCameraType(current => (current === "back" ? "front" : "back"));
  };

  const handleFlashPress = () => {
    setFlash(current => (current === "off" ? "on" : "off"));
  };

  const handleTimestampToggle = () => {
    setTimestampEnabled(current => !current);
  };

  const handleRecordingStart = () => {
    console.log("Recording started");
  };

  const handleThumbnailPress = useCallback(async () => {
    if (!hasMediaPermission) {
      Alert.alert("Permission Required", "Media library access is required to view videos.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]);
      return;
    }

    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: "video",
        sortBy: ["creationTime"]
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

    const formattedUri = videoUri.startsWith("file://") ? videoUri : `file://${videoUri}`;

    if (hasMediaPermission) {
      try {
        const asset = await MediaLibrary.createAssetAsync(formattedUri);
        console.log("Video saved to library:", asset);

        const { uri } = await VideoThumbnails.getThumbnailAsync(formattedUri, {
          quality: 0.8,
          time: 1000
        });
        setLatestVideoThumbnail(uri);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          Alert.alert("Video Recorded", "Your retro video has been saved. Share it?", [
            { text: "No", style: "cancel" },
            { text: "Share", onPress: () => Sharing.shareAsync(formattedUri) }
          ]);
        }
      } catch (error) {
        console.error("Error saving video:", error);
        Alert.alert("Error", "There was an error saving your video.");
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
        pausePreview={showMediaBrowser}
      />

      <TimestampOverlay enabled={timestampEnabled} position="topRight" />

      <TouchableOpacity style={styles.mediaLibraryButton} onPress={handleThumbnailPress}>
        {latestVideoThumbnail ? (
          <Image source={{ uri: latestVideoThumbnail }} style={styles.mediaPreview} />
        ) : (
          <Ionicons name="images" size={24} color="white" />
        )}
      </TouchableOpacity>

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

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordingButton]}
        onPress={handleRecordPress}
      >
        {isRecording && <View style={styles.stopIcon} />}
      </TouchableOpacity>

      {showMediaBrowser && (
        <MediaBrowser
          assets={mediaAssets}
          onClose={() => setShowMediaBrowser(false)}
        />
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
  recordButton: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
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
});
