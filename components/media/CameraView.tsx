import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraFormat, useMicrophonePermission } from "react-native-vision-camera";

interface SDCameraViewProps {
  onCameraReady?: () => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: (uri: string) => void;
  isRecording?: boolean;
  cameraType?: "front" | "back";
  flash?: "off" | "on";
  pausePreview?: boolean;
  audioEnabled?: boolean;
}

const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

export default function SDCameraView({
  onCameraReady,
  onRecordingStart,
  onRecordingEnd,
  isRecording = false,
  cameraType = "back",
  flash = "off",
  pausePreview = false
}: SDCameraViewProps) {
  const cameraRef = useRef<Camera>(null);
  const isMounted = useRef(true);
  const isCurrentlyRecording = useRef(false);
  const recordingAnimation = useSharedValue(1);
  const { hasPermission: microphonePermission } = useMicrophonePermission();

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

  const CameraReady = () => {
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (isCurrentlyRecording.current) {
        stopRecording();
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

  if (!device) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ReanimatedCamera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={!pausePreview}
        video={true}
        audio={microphonePermission}
        format={format}
        onInitialized={onCameraReady}
        enableZoomGesture={false}
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
