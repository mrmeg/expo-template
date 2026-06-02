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

import React, { useMemo, useEffect } from "react";
import { useEvent } from "expo";
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
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
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
  const styles = useMemo(() => createStyles(theme, topInset), [theme, topInset]);

  // Create video player instance with the source
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    if (autoPlay && visible) {
      player.play();
    }
  });

  // Derive loading/error UI straight from the player's reactive status —
  // useEvent re-renders on each `statusChange`, so there's no mirrored state
  // to fall out of sync and no polling interval to leak.
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const isLoading = status === "loading";
  const hasError = status === "error";

  // Sync playback with visibility — a genuine external-system effect.
  // Pausing on cleanup stops audio when the modal closes or the player is
  // swapped, instead of letting it bleed into the background.
  useEffect(() => {
    if (visible && autoPlay) {
      player.play();
    } else {
      player.pause();
    }
    return () => {
      player.pause();
    };
  }, [visible, autoPlay, player]);

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
            <Icon name="x" size={24} color="white" />
          </Pressable>
        </View>

        {/* Video content */}
        <View style={styles.videoContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <SansSerifText style={styles.loadingText}>
                Loading video…
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
      ...StyleSheet.absoluteFill,
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
      ...StyleSheet.absoluteFill,
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

export default VideoPlayer;
