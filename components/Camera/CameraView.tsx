import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { CameraView as ExpoCameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

interface SDCameraViewProps {
  onCameraReady?: () => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: (uri: string) => void;
  isRecording?: boolean;
  cameraType?: CameraType;
  flash?: FlashMode;
}

const ReanimatedCamera = Animated.createAnimatedComponent(ExpoCameraView);

export default function SDCameraView({
  onCameraReady,
  onRecordingStart,
  onRecordingEnd,
  isRecording = false,
  cameraType = "back",
  flash = "off"
}: SDCameraViewProps) {
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<ExpoCameraView>(null);
  const isMounted = useRef(true);
  const isCurrentlyRecording = useRef(false);
  const recordingAnimation = useSharedValue(1);

  // Animation style for recording indicator
  const recordingIndicatorStyle = useAnimatedStyle(() => ({
    opacity: recordingAnimation.value,
    transform: [{ scale: recordingAnimation.value }]
  }));

  const handleCameraReady = () => {
    onCameraReady?.();
  };

  const pulseRecording = () => {
    recordingAnimation.value = withTiming(0.8, { duration: 500 }, () => {
      if (isRecording) {
        recordingAnimation.value = withTiming(1, { duration: 500 }, pulseRecording);
      }
    });
  };

  const startRecording = async () => {
    if (!cameraRef.current || isCurrentlyRecording.current) return;

    try {
      isCurrentlyRecording.current = true;
      onRecordingStart?.();
      pulseRecording();

      const recordingPromise = cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      recordingPromise.then(result => {
        if (result?.uri && isMounted.current) {
          onRecordingEnd?.(result.uri);
        }
        isCurrentlyRecording.current = false;
        recordingAnimation.value = 1;
      }).catch(error => {
        console.error("Recording error:", error);
        isCurrentlyRecording.current = false;
        recordingAnimation.value = 1;
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      isCurrentlyRecording.current = false;
      recordingAnimation.value = 1;
    }
  };

  const stopRecording = () => {
    if (!isCurrentlyRecording.current) return;
    cameraRef.current?.stopRecording();
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (isCurrentlyRecording.current) {
        cameraRef.current?.stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording]);

  if (!permission?.granted) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ReanimatedCamera
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flash}
        enableTorch={flash === "on"}
        onCameraReady={handleCameraReady}
        mode="video"
        zoom={0}
      >
        <Animated.View style={[styles.recordingIndicator, recordingIndicatorStyle]} />
      </ReanimatedCamera>
    </View>
  );
}

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
