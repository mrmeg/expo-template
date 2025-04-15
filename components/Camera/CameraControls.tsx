import React from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

interface CameraControlsProps {
  isRecording: boolean;
  onRecordPress: () => void;
  onFlipPress: () => void;
  onFlashPress: () => void;
  onTimestampToggle: () => void;
  flashEnabled: boolean;
  timestampEnabled: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function CameraControls({
  isRecording,
  onRecordPress,
  onFlipPress,
  onFlashPress,
  onTimestampToggle,
  flashEnabled,
  timestampEnabled
}: CameraControlsProps) {
  const insets = useSafeAreaInsets();
  
  // Animated style for record button
  const recordButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withTiming(isRecording ? 1.2 : 1) },
      ],
      backgroundColor: withTiming(isRecording ? "#ff4040" : "#ffffff")
    };
  });

  // Handle record button press with haptic feedback
  const handleRecordPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRecordPress();
  };

  // Handle control button press with haptic feedback
  const handleControlPress = (callback: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    callback();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      {/* Top Row Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => handleControlPress(onFlashPress)}
        >
          <MaterialIcons 
            name={flashEnabled ? "flash-on" : "flash-off"} 
            size={28} 
            color="white" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => handleControlPress(onTimestampToggle)}
        >
          <MaterialIcons 
            name={timestampEnabled ? "timer" : "timer-off"} 
            size={28} 
            color="white" 
          />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Row with Record Button */}
      <View style={styles.bottomControls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => handleControlPress(onFlipPress)}
        >
          <MaterialIcons name="flip-camera-android" size={28} color="white" />
        </TouchableOpacity>
        
        <AnimatedTouchable 
          style={[styles.recordButton, recordButtonStyle]}
          onPress={handleRecordPress}
          activeOpacity={0.8}
        >
          <View style={[styles.recordButtonInner, isRecording && styles.recordingButtonInner]} />
        </AnimatedTouchable>
        
        <View style={styles.controlButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 30,
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#ff0000",
    backgroundColor: "transparent",
  },
  recordingButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#ff0000",
    borderWidth: 0,
  },
});