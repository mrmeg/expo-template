import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraType, FlashMode, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import SDCameraView from '@/components/Camera/CameraView';
import CameraControls from '@/components/Camera/CameraControls';
import TimestampOverlay from '@/components/Camera/TimestampOverlay';

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [timestampEnabled, setTimestampEnabled] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [lastRecordedVideo, setLastRecordedVideo] = useState<string | null>(null);
  const [latestVideoThumbnail, setLatestVideoThumbnail] = useState<string | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);

  // Request media library permissions
  useEffect(() => {
    (async () => {
      // Request camera and microphone permissions
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }

      // Request media library permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaPermission(status === 'granted');
    })();
  }, []);

  const getLatestVideoThumbnail = async () => {
    if (!hasMediaPermission) return;

    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        sortBy: ['creationTime'],
        first: 1
      });

      if (assets.length > 0) {
        const { uri } = await VideoThumbnails.getThumbnailAsync(assets[0].uri, {
          quality: 0.8,
          time: 1000
        });
        setLatestVideoThumbnail(uri);
        setShowMediaPreview(true);
      }
    } catch (error) {
      console.error('Error getting video thumbnail:', error);
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
      current === 'back' ? 'front' : 'back'
    );
  };

  // Handle flash toggle - cycle between off and on
  const handleFlashPress = () => {
    setFlash(current =>
      current === 'off' ? 'on' : 'off'
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
    console.log('Recording started');
  };

  // Handle recording end and save/share video
  const handleRecordingEnd = async (videoUri: string) => {
    console.log('Recording ended:', videoUri);
    // Recording state is already managed by the record button
    setLastRecordedVideo(videoUri);

    if (hasMediaPermission) {
      try {
        // Save video to media library
        const asset = await MediaLibrary.createAssetAsync(videoUri);
        console.log('Video saved to library:', asset);

        // Show share option
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          Alert.alert(
            'Video Recorded',
            'Your retro video has been saved to your library. Do you want to share it?',
            [
              {
                text: 'No',
                style: 'cancel',
              },
              {
                text: 'Share',
                onPress: () => Sharing.shareAsync(videoUri),
              },
            ],
          );
        }
      } catch (error) {
        console.error('Error saving video:', error);
        Alert.alert(
          'Error',
          'There was an error saving your video.'
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
        position="bottomRight"
      />

      <CameraControls
        isRecording={isRecording}
        onRecordPress={handleRecordPress}
        onFlipPress={handleFlipPress}
        onFlashPress={handleFlashPress}
        onTimestampToggle={handleTimestampToggle}
        flashEnabled={flash === 'on'}
        timestampEnabled={timestampEnabled}
      />

      {showMediaPreview && latestVideoThumbnail && (
        <View style={styles.mediaPreview}>
          <Image
            source={{ uri: latestVideoThumbnail }}
            style={styles.thumbnail}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPreview: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 80,
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  }
});
