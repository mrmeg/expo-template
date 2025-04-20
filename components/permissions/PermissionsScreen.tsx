import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from "react-native";
import { Camera, CameraPermissionStatus } from "react-native-vision-camera";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";

interface PermissionsScreenProps {
  onPermissionsGranted: () => void;
}

export const PermissionsScreen = ({ onPermissionsGranted }: PermissionsScreenProps) => {
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>("not-determined");
  const [microphonePermission, setMicrophonePermission] = useState<CameraPermissionStatus>("not-determined");
  const [mediaPermission, setMediaPermission] = useState<MediaLibrary.PermissionStatus | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const camera = await Camera.getCameraPermissionStatus();
    const microphone = await Camera.getMicrophonePermissionStatus();
    const media = await MediaLibrary.getPermissionsAsync();
    
    setCameraPermission(camera);
    setMicrophonePermission(microphone);
    setMediaPermission(media.status);

    if (camera === "granted" && microphone === "granted" && media.status === "granted") {
      onPermissionsGranted();
    }
  };

  const requestCameraPermission = async () => {
    if (cameraPermission !== "granted") {
      const permission = await Camera.requestCameraPermission();
      setCameraPermission(permission);
      
      if (permission === "granted" && microphonePermission === "granted" && mediaPermission === "granted") {
        onPermissionsGranted();
      } else if (permission === "denied") {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to use this app.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
          ]
        );
      }
    }
  };

  const requestMicrophonePermission = async () => {
    if (microphonePermission !== "granted") {
      const permission = await Camera.requestMicrophonePermission();
      setMicrophonePermission(permission);
      
      if (permission === "granted" && cameraPermission === "granted" && mediaPermission === "granted") {
        onPermissionsGranted();
      } else if (permission === "denied") {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in your device settings to record videos with sound.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
          ]
        );
      }
    }
  };

  const requestMediaPermission = async () => {
    if (mediaPermission !== "granted") {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaPermission(status);
      
      if (status === "granted" && cameraPermission === "granted" && microphonePermission === "granted") {
        onPermissionsGranted();
      } else if (status === "denied") {
        Alert.alert(
          "Media Library Permission Required",
          "Please enable media library access in your device settings to save and view videos.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
          ]
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="camera" size={64} color="#fff" style={styles.icon} />
        <Text style={styles.title}>Permissions Required</Text>
        <Text style={styles.description}>
          This app needs access to your camera, microphone, and media library to record and save videos.
          Please grant the necessary permissions to continue.
        </Text>

        <View style={styles.permissionButtons}>
          <TouchableOpacity
            style={[
              styles.permissionButton,
              cameraPermission === "granted" && styles.permissionGranted
            ]}
            onPress={requestCameraPermission}
            disabled={cameraPermission === "granted"}
          >
            <Ionicons
              name={cameraPermission === "granted" ? "checkmark-circle" : "camera"}
              size={24}
              color={cameraPermission === "granted" ? "#4CAF50" : "#fff"}
            />
            <Text style={styles.permissionButtonText}>
              {cameraPermission === "granted" ? "Camera Access Granted" : "Grant Camera Access"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.permissionButton,
              microphonePermission === "granted" && styles.permissionGranted
            ]}
            onPress={requestMicrophonePermission}
            disabled={microphonePermission === "granted"}
          >
            <Ionicons
              name={microphonePermission === "granted" ? "checkmark-circle" : "mic"}
              size={24}
              color={microphonePermission === "granted" ? "#4CAF50" : "#fff"}
            />
            <Text style={styles.permissionButtonText}>
              {microphonePermission === "granted" ? "Microphone Access Granted" : "Grant Microphone Access"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.permissionButton,
              mediaPermission === "granted" && styles.permissionGranted
            ]}
            onPress={requestMediaPermission}
            disabled={mediaPermission === "granted"}
          >
            <Ionicons
              name={mediaPermission === "granted" ? "checkmark-circle" : "images"}
              size={24}
              color={mediaPermission === "granted" ? "#4CAF50" : "#fff"}
            />
            <Text style={styles.permissionButtonText}>
              {mediaPermission === "granted" ? "Media Library Access Granted" : "Grant Media Library Access"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
    alignItems: "center",
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
    opacity: 0.8,
  },
  permissionButtons: {
    width: "100%",
    gap: 15,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  permissionGranted: {
    backgroundColor: "#1a1a1a",
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
}); 