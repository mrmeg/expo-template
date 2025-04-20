import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  AppState
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "@/components/media/CameraView";
import { TimestampOverlay } from "@/components/media/TimestampOverlay";
import { MediaBrowser } from "@/components/media/MediaBrowser";
import { PermissionsScreen } from "@/components/permissions/PermissionsScreen";
import { Camera } from "react-native-vision-camera";

export default function CameraScreen() {
  const [showPermissions, setShowPermissions] = useState(true);
  const [mediaPermission, setMediaPermission] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [timestampEnabled, setTimestampEnabled] = useState(true);
  const [latestVideoThumbnail, setLatestVideoThumbnail] = useState<string | null>(null);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cameraRestricted, setCameraRestricted] = useState(false);

  useEffect(() => {
    checkPermissions();
    
    // Add app state listener to detect when app comes back from background
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active") {
        // Check camera status when app becomes active
        checkCameraStatus();
      }
    });
    
    // Initial camera status check
    checkCameraStatus();
    
    return () => {
      subscription.remove();
    };
  }, []);

  const checkCameraStatus = async () => {
    try {
      console.log("Checking camera status...");
      const devices = await Camera.getAvailableCameraDevices();
      console.log("Available camera devices:", devices);
      
      if (devices.length === 0) {
        console.log("No camera devices available");
        setCameraRestricted(true);
        return;
      }

      const device = devices.find(d => d.position === cameraType);
      if (!device) {
        console.log(`Camera device not available for position: ${cameraType}`);
        setCameraRestricted(true);
        return;
      }

      // If we have a valid device, camera is not restricted
      setCameraRestricted(false);
    } catch (error) {
      console.error("Error checking camera status:", error);
      setCameraRestricted(true);
    }
  };

  const handleRestartCamera = async () => {
    try {
      console.log("Attempting to restart camera...");
      // First try to toggle camera type
      setCameraType(prev => prev === "back" ? "front" : "back");
      
      // Wait a short moment for the camera type change to take effect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if camera is now available
      await checkCameraStatus();
      
      if (cameraRestricted) {
        console.log("Camera still restricted after toggle, trying to reinitialize...");
        // If still restricted, try to reinitialize the camera
        setCameraType("back"); // Reset to back camera
        await new Promise(resolve => setTimeout(resolve, 500));
        await checkCameraStatus();
      }
    } catch (error) {
      console.error("Error restarting camera:", error);
    }
  };

  const checkPermissions = async () => {
    // Only check current status, don't request permissions
    const camera = await Camera.getCameraPermissionStatus();
    const microphone = await Camera.getMicrophonePermissionStatus();
    const media = await MediaLibrary.getPermissionsAsync();
    
    setMediaPermission(media.status);

    // Show permissions screen if any permission is not granted
    setShowPermissions(camera !== "granted" || microphone !== "granted" || media.status !== "granted");
  };

  const handlePermissionsGranted = () => {
    setShowPermissions(false);
  };

  const getLatestVideoThumbnail = useCallback(async () => {
    if (!mediaPermission || mediaPermission !== "granted") return;

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
  }, [mediaPermission]);

  useEffect(() => {
    if (mediaPermission && mediaPermission === "granted") {
      getLatestVideoThumbnail();
    }
  }, [mediaPermission, getLatestVideoThumbnail]);

  const handleRecordPress = async () => {
    // Check permissions before recording
    const camera = await Camera.getCameraPermissionStatus();
    const microphone = await Camera.getMicrophonePermissionStatus();
    const media = await MediaLibrary.getPermissionsAsync();

    if (camera !== "granted") {
      Alert.alert(
        "Camera Permission Required",
        "Please grant camera access to record videos.",
        [{ text: "OK" }]
      );
      return;
    }

    if (microphone !== "granted") {
      Alert.alert(
        "Microphone Permission Required",
        "Please grant microphone access to record videos with sound.",
        [{ text: "OK" }]
      );
      return;
    }

    if (media.status !== "granted") {
      Alert.alert(
        "Media Library Permission Required",
        "Please grant media library access to save videos.",
        [{ text: "OK" }]
      );
      return;
    }

    // Start recording if all permissions are granted
    setIsRecording(current => !current);
  };

  const handleAssetDeleted = useCallback(async (deletedAsset: MediaLibrary.Asset) => {
    console.log("CameraScreen: Asset deletion notification received for asset:", deletedAsset.id);
    
    // Immediately update UI
    console.log("CameraScreen: Updating UI to remove deleted asset");
    setMediaAssets(prev => prev.filter(a => a.id !== deletedAsset.id));

    // Refresh media library completely
    try {
      console.log("CameraScreen: Refreshing media library");
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: "video",
        sortBy: ["creationTime"]
      });
      console.log("CameraScreen: Retrieved", assets.length, "assets from media library");
      setMediaAssets(assets);

      // Update thumbnail only if we have assets
      if (assets.length > 0) {
        try {
          console.log("CameraScreen: Updating thumbnail with first asset");
          const { uri } = await VideoThumbnails.getThumbnailAsync(assets[0].uri);
          setLatestVideoThumbnail(uri);
        } catch (thumbnailError) {
          console.warn("CameraScreen: Could not update thumbnail:", thumbnailError);
          // If we can't get the thumbnail, just clear it
          setLatestVideoThumbnail(null);
        }
      } else {
        console.log("CameraScreen: No assets left, clearing thumbnail");
        setLatestVideoThumbnail(null);
      }
    } catch (error) {
      console.warn("CameraScreen: Refresh error:", error);
      // Even if refresh fails, we've already updated the UI
      // Just clear the thumbnail to be safe
      setLatestVideoThumbnail(null);
    }
  }, []);

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
    if (!mediaPermission || mediaPermission !== "granted") {
      // Check if we need to request permission
      const { status } = await MediaLibrary.getPermissionsAsync();
      
      if (status !== "granted") {
        // Request permission if not granted
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        setMediaPermission(newStatus);
        
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please grant media library access to view your videos.",
            [{ text: "OK" }]
          );
          return;
        }
      } else {
        // Permission is granted but state is not updated
        setMediaPermission(status);
      }
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
  }, [mediaPermission]);

  const handleRecordingEnd = useCallback(async (videoUri: string) => {
    console.log("Recording ended:", videoUri);

    const formattedUri = videoUri.startsWith("file://") ? videoUri : `file://${videoUri}`;

    // Check if we have permission to save to media library
    if (!mediaPermission || mediaPermission !== "granted") {
      // Check if we need to request permission
      const { status } = await MediaLibrary.getPermissionsAsync();
      
      if (status !== "granted") {
        // Request permission if not granted
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        setMediaPermission(newStatus);
        
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please grant media library access to save your videos.",
            [{ text: "OK" }]
          );
          return;
        }
      } else {
        // Permission is granted but state is not updated
        setMediaPermission(status);
      }
    }

    try {
      const asset = await MediaLibrary.createAssetAsync(formattedUri);
      console.log("Video saved to library:", asset);

      const { uri } = await VideoThumbnails.getThumbnailAsync(formattedUri, {
        quality: 0.8,
        time: 1000
      });
      setLatestVideoThumbnail(uri);
    } catch (error) {
      console.error("Error saving video:", error);
      Alert.alert("Error", "There was an error saving your video.");
    }
  }, [mediaPermission]);

  if (showPermissions) {
    return <PermissionsScreen onPermissionsGranted={handlePermissionsGranted} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {cameraRestricted ? (
        <View style={styles.cameraRestrictedContainer}>
          <Ionicons name="camera" size={64} color="white" />
          <Text style={styles.cameraRestrictedText}>
            Camera access is restricted. This can happen when the app is reopened from background.
          </Text>
          <TouchableOpacity 
            style={styles.restartCameraButton}
            onPress={handleRestartCamera}
          >
            <Text style={styles.restartCameraButtonText}>Restart Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <CameraView
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
        </>
      )}

      {showMediaBrowser && (
        <MediaBrowser
          assets={mediaAssets}
          onClose={() => setShowMediaBrowser(false)}
          onAssetDeleted={handleAssetDeleted}
          hasMediaPermission={mediaPermission === "granted"}
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
  cameraRestrictedContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  cameraRestrictedText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
    lineHeight: 24,
  },
  restartCameraButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  restartCameraButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
