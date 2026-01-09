/**
 * VideoPlayer component using expo-video.
 *
 * Provides a modal-based video player with native controls,
 * fullscreen support, and loading states.
 *
 * @example
 * ```tsx
 * <VideoPlayer
 *   uri={signedUrl}
 *   visible={showPlayer}
 *   onClose={() => setShowPlayer(false)}
 * />
 * ```
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { X } from "lucide-react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { Icon } from "./ui/Icon";
import { SansSerifText } from "./ui/StyledText";
import type { Theme } from "@/client/constants/colors";
import {
  useSafeAreaInsets,
  initialWindowMetrics,
} from "react-native-safe-area-context";

interface VideoPlayerProps {
  /** Video source URL (typically a signed URL) */
  uri: string;
  /** Whether the player modal is visible */
  visible: boolean;
  /** Callback when player is closed */
  onClose: () => void;
  /** Optional title to display */
  title?: string;
  /** Auto-play when opened (default: true) */
  autoPlay?: boolean;
}

export function VideoPlayer({
  uri,
  visible,
  onClose,
  title,
  autoPlay = true,
}: VideoPlayerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Use initialWindowMetrics as fallback since Modal may not have SafeAreaProvider context
  const topInset = insets.top || initialWindowMetrics?.insets.top || 0;
  const styles = createStyles(theme, topInset);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Create video player instance with the source
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    if (autoPlay && visible) {
      player.play();
    }
  });

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
      if (autoPlay) {
        player.play();
      }
    } else {
      player.pause();
    }
  }, [visible, autoPlay, player]);

  // Track player status for loading/error states
  useEffect(() => {
    const checkStatus = () => {
      if (player.status === "readyToPlay" || player.status === "idle") {
        setIsLoading(false);
      }
      if (player.status === "error") {
        setIsLoading(false);
        setHasError(true);
      }
    };

    // Check immediately and set up polling for status changes
    checkStatus();
    const interval = setInterval(checkStatus, 100);

    return () => clearInterval(interval);
  }, [player]);

  // Handle close
  const handleClose = () => {
    player.pause();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />

        {/* Header with close button */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {title && (
              <SansSerifText style={styles.title} numberOfLines={1}>
                {title}
              </SansSerifText>
            )}
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={20}
          >
            <Icon as={X} size={24} color="white" />
          </Pressable>
        </View>

        {/* Video content */}
        <View style={styles.videoContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <SansSerifText style={styles.loadingText}>
                Loading video...
              </SansSerifText>
            </View>
          )}

          {hasError && (
            <View style={styles.errorOverlay}>
              <SansSerifText style={styles.errorText}>
                Failed to load video
              </SansSerifText>
              <Pressable onPress={handleClose} style={styles.errorButton}>
                <SansSerifText style={styles.errorButtonText}>
                  Close
                </SansSerifText>
              </Pressable>
            </View>
          )}

          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
            allowsFullscreen
            allowsPictureInPicture={Platform.OS !== "web"}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "black",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop: topInset,
      paddingBottom: spacing.sm,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    headerContent: {
      flex: 1,
      marginRight: spacing.md,
    },
    title: {
      color: "white",
      fontSize: 16,
      fontWeight: "500",
    },
    closeButton: {
      padding: spacing.xs,
      borderRadius: spacing.radiusFull,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    videoContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    video: {
      width: "100%",
      height: "100%",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "black",
      zIndex: 5,
    },
    loadingText: {
      color: "white",
      marginTop: spacing.md,
      fontSize: 14,
    },
    errorOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "black",
      zIndex: 5,
    },
    errorText: {
      color: "white",
      fontSize: 16,
      marginBottom: spacing.md,
    },
    errorButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.colors.primary,
      borderRadius: spacing.radiusMd,
    },
    errorButtonText: {
      color: theme.colors.primaryForeground,
      fontSize: 14,
      fontWeight: "500",
    },
  });

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default VideoPlayer;
