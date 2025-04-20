import React, { useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Platform, AppState } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraFormat, useMicrophonePermission } from "react-native-vision-camera";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { Alert } from "../ui/Alert";

interface SDCameraViewProps {
  onCameraReady?: () => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: (uri: string) => void;
  isRecording?: boolean;
  cameraType?: "front" | "back";
  flash?: "off" | "on";
  pausePreview?: boolean;
  audioEnabled?: boolean;
  onAssetDeleted?: (asset: MediaLibrary.Asset) => void;
}

const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

export const CameraView = ({
  onCameraReady,
  onRecordingStart,
  onRecordingEnd,
  isRecording = false,
  cameraType = "back",
  flash = "off",
  pausePreview = false,
  audioEnabled = true,
  onAssetDeleted
}: SDCameraViewProps) => {
  const cameraRef = useRef<Camera>(null);
  const isMounted = useRef(true);
  const isCurrentlyRecording = useRef(false);
  const recordingAnimation = useSharedValue(1);
  const { hasPermission: microphonePermission } = useMicrophonePermission();
  const [isActive, setIsActive] = React.useState(!pausePreview);

  const device = useCameraDevice(cameraType);
  const format = useCameraFormat(device, [
    { videoResolution: "max" },
    { fps: 60 }
  ]);

  // Animation style for recording indicator
  const recordingIndicatorStyle = useAnimatedStyle(() => ({
    opacity: recordingAnimation.value,
    transform: [{ scale: recordingAnimation.value }]
  }));

  const pulseRecording = () => {
    recordingAnimation.value = withTiming(0.8, { duration: 500 }, () => {
      if (isRecording) {
        recordingAnimation.value = withTiming(1, { duration: 500 }, pulseRecording);
      }
    });
  };

  const startRecording = async () => {
    if (!cameraRef.current || isCurrentlyRecording.current || !device) return;

    try {
      isCurrentlyRecording.current = true;
      onRecordingStart?.();
      pulseRecording();

      cameraRef.current.startRecording({
        flash: flash,
        onRecordingFinished: (video) => {
          if (isMounted.current && video.path) {
            onRecordingEnd?.(video.path);
          }
          isCurrentlyRecording.current = false;
          recordingAnimation.value = 1;
        },
        onRecordingError: (error) => {
          console.error("Recording error:", error);
          isCurrentlyRecording.current = false;
          recordingAnimation.value = 1;
        }
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      isCurrentlyRecording.current = false;
      recordingAnimation.value = 1;
    }
  };

  const stopRecording = async () => {
    if (!isCurrentlyRecording.current) return;
    try {
      await cameraRef.current?.stopRecording();
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleDeleteAsset = useCallback(async (asset: MediaLibrary.Asset) => {
    try {
      console.log("Starting deletion process for asset:", asset.id);
      
      if (Platform.OS === "android") {
        // On Android, try to delete directly using the asset's URI
        console.log("Attempting to delete from media library on Android...");
        const deleteSuccess = await MediaLibrary.deleteAssetsAsync([asset.id]);
        console.log("Delete success on Android:", deleteSuccess);

        if (!deleteSuccess) {
          throw new Error("Failed to delete from media library on Android");
        }
      } else {
        // iOS deletion process remains the same
        const freshAsset = await MediaLibrary.getAssetInfoAsync(asset.id);
        console.log("Fresh asset info:", freshAsset);

        console.log("Attempting to delete from media library on iOS...");
        const deleteSuccess = await MediaLibrary.deleteAssetsAsync([asset.id]);
        console.log("Delete success on iOS:", deleteSuccess);

        if (!deleteSuccess) {
          throw new Error("Failed to delete from media library on iOS");
        }

        // Only try to delete local file on iOS
        if (freshAsset.localUri) {
          try {
            console.log("Attempting to delete local file:", freshAsset.localUri);
            await FileSystem.deleteAsync(freshAsset.localUri, { idempotent: true });
            console.log("Local file deleted successfully");
          } catch (fileError) {
            console.warn("Couldn't delete local file:", fileError);
          }
        }
      }

      // Clean up cached files for both platforms
      const cachedPath = `${FileSystem.documentDirectory}${asset.filename || asset.id}`;
      try {
        console.log("Attempting to delete cached file:", cachedPath);
        await FileSystem.deleteAsync(cachedPath, { idempotent: true });
        console.log("Cached file deleted successfully");
      } catch (cacheError) {
        console.warn("Couldn't delete cached file:", cacheError);
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

    } catch (error) {
      console.error("Full deletion error:", error);
      Alert.show({
        title: "Error",
        message: "Could not delete media. Please try again.",
        buttons: [{ text: "OK", style: "destructive" }]
      });
    }
  }, [onAssetDeleted]);

  useEffect(() => {
    isMounted.current = true;
    
    // Add app state listener
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active") {
        // When app becomes active, reinitialize the camera
        setIsActive(false);
        setTimeout(() => {
          setIsActive(true);
        }, 100);
      } else if (nextAppState === "background") {
        // When app goes to background, stop the camera
        setIsActive(false);
      }
    });

    return () => {
      isMounted.current = false;
      subscription.remove();
      if (isCurrentlyRecording.current) {
        stopRecording();
      }
    };
  }, []);

  // Update isActive when pausePreview changes
  useEffect(() => {
    setIsActive(!pausePreview);
  }, [pausePreview]);

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording]);

  if (!device) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ReanimatedCamera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isActive}
        video={true}
        audio={audioEnabled && microphonePermission}
        format={format}
        onInitialized={onCameraReady}
        enableZoomGesture={false}
      >
        <Animated.View style={[styles.recordingIndicator, recordingIndicatorStyle]} />
      </ReanimatedCamera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  recordingIndicator: {
    position: "absolute",
    top: 40,
    right: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "red"
  },
});
