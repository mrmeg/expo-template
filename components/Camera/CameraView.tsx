import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView as ExpoCameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { SansSerifText } from '@/components/ui/StyledText';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface SDCameraViewProps {
  onCameraReady?: () => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: (uri: string) => void;
  isRecording?: boolean;
  cameraType?: CameraType;
  flash?: FlashMode;
}

export default function SDCameraView({
  onCameraReady,
  onRecordingStart,
  onRecordingEnd,
  isRecording = false,
  cameraType: externalCameraType,
  flash: externalFlash
}: SDCameraViewProps) {
  // Skip the isRecording prop-based implementation and use direct methods instead
  const [permission, requestPermission] = useCameraPermissions();
  const [internalCameraType, setInternalCameraType] = useState<CameraType>('back');
  const [internalFlash, setInternalFlash] = useState<FlashMode>('off');
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Use external values if provided, otherwise use internal state
  const facing = externalCameraType ?? internalCameraType;
  const flash = externalFlash ?? internalFlash;

  const cameraRef = useRef<ExpoCameraView>(null);
  const recordingAnimation = useSharedValue(1);

  // Handle camera ready state
  const handleCameraReady = () => {
    setIsCameraReady(true);
    onCameraReady?.();
  };

  // Animation style for recording indicator
  const recordingIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(recordingAnimation.value),
      transform: [{ scale: withTiming(recordingAnimation.value) }]
    };
  });

  // Track if we're currently recording
  const [isCurrentlyRecording, setIsCurrentlyRecording] = useState(false);

  // Expose start recording method
  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady || isCurrentlyRecording) {
      console.log('Cannot start recording:', { isCameraReady, isCurrentlyRecording });
      return;
    }

    try {
      // Start animation and notify parent
      startRecordingAnimation();
      onRecordingStart?.();
      setIsCurrentlyRecording(true);

      const options = {
        quality: '1080p',
        maxDuration: 60,
        mute: false
      };

      console.log('Starting recording with camera ref:', cameraRef.current);

      // Start recording
      const recordingPromise = cameraRef.current.recordAsync(options);

      // Handle recording completion
      recordingPromise.then(result => {
        console.log('Recording completed:', result);
        if (result && result.uri) {
          onRecordingEnd?.(result.uri);
        }
        setIsCurrentlyRecording(false);
        recordingAnimation.value = 1;
      }).catch(error => {
        console.error('Recording error:', error);
        setIsCurrentlyRecording(false);
        recordingAnimation.value = 1;
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsCurrentlyRecording(false);
      recordingAnimation.value = 1;
    }
  };

  // Expose stop recording method
  const stopRecording = () => {
    if (!cameraRef.current || !isCurrentlyRecording) {
      console.log('Cannot stop recording:', { isCurrentlyRecording });
      return;
    }

    try {
      console.log('Stopping recording...');
      cameraRef.current.stopRecording();
      // The recording promise will resolve and handle cleanup
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsCurrentlyRecording(false);
      recordingAnimation.value = 1;
    }
  };

  // Listen to the isRecording prop changes
  useEffect(() => {
    if (isRecording && !isCurrentlyRecording) {
      startRecording();
    } else if (!isRecording && isCurrentlyRecording) {
      stopRecording();
    }

    // Cleanup on unmount
    return () => {
      if (isCurrentlyRecording && cameraRef.current) {
        try {
          cameraRef.current.stopRecording();
        } catch (error) {
          console.error('Error stopping recording on unmount:', error);
        }
      }
    };
  }, [isRecording, isCurrentlyRecording, isCameraReady]);

  // Start recording animation function
  const startRecordingAnimation = () => {
    // Start recording animation
    recordingAnimation.value = 1;
    const pulseRecording = () => {
      recordingAnimation.value = 0.8;
      setTimeout(() => {
        if (isRecording) {
          recordingAnimation.value = 1;
          setTimeout(pulseRecording, 1000);
        }
      }, 1000);
    };
    pulseRecording();
  };

  // Flip camera function
  const flipCamera = () => {
    setInternalCameraType(current =>
      current === 'back' ? 'front' : 'back'
    );
  };

  // Toggle flash mode
  const toggleFlash = () => {
    setInternalFlash(current =>
      current === 'off' ? 'on' : 'off'
    );
  };

  // Handle permission state
  if (!permission) {
    // Camera permissions are still loading
    return <View style={styles.container}><SansSerifText>Requesting camera permissions...</SansSerifText></View>;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <SansSerifText>No access to camera</SansSerifText>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <SansSerifText style={styles.permissionButtonText}>Grant Permission</SansSerifText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        enableTorch={flash === 'on'}
        onCameraReady={handleCameraReady}
        mode="video"
        zoom={0}
      >
        {isRecording && (
          <Animated.View style={[styles.recordingIndicator, recordingIndicatorStyle]} />
        )}
      </ExpoCameraView>

      {/* Camera controls will be added here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  camera: {
    flex: 1,
    width: '100%',
    position: 'relative'
  },
  recordingIndicator: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red'
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16
  }
});
