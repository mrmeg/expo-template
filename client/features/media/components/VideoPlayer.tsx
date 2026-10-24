/**
 * VideoPlayer component using the design system's `Video`.
 *
 * Provides a modal-based video player with native controls, fullscreen
 * support, and loading and error states (`Video` draws the last two).
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

import React from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  // eslint-disable-next-line expo-ui/no-raw-primitives -- full-screen player over black forces light status-bar content; the design-system StatusBar follows the theme
  StatusBar,
} from "react-native";
import { withAlpha } from "@mrmeg/expo-ui/hooks";
import { palette, spacing } from "@mrmeg/expo-ui/constants";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { LazyVideo } from "@/client/components/LazyVideo";
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
  const insets = useSafeAreaInsets();
  // Use initialWindowMetrics as fallback since Modal may not have SafeAreaProvider context
  const topInset = insets.top || initialWindowMetrics?.insets.top || 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header with close button */}
        <View style={[styles.header, { paddingTop: topInset }]}>
          <View style={styles.headerContent}>
            {title && (
              <SansSerifText fontWeight="medium" style={styles.title} numberOfLines={1}>
                {title}
              </SansSerifText>
            )}
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={20}
          >
            <Icon name="x" size={24} color={palette.white} />
          </Pressable>
        </View>

        {/* Video content: the modal's children unmount when it closes, which
            pauses the player, so nothing keeps playing behind a closed sheet. */}
        <View style={styles.videoContainer}>
          <LazyVideo
            source={{ uri }}
            controls="native"
            fill
            autoPlay={autoPlay}
            title={title}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: withAlpha(palette.black, 0.8),
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
    color: palette.white,
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: spacing.radiusFull,
    backgroundColor: withAlpha(palette.white, 0.2),
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
