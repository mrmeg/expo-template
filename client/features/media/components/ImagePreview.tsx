import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { palette, spacing, type Theme } from "@mrmeg/expo-ui/constants";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";

interface ImagePreviewProps {
  uri: string;
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export function ImagePreview({
  uri,
  visible,
  onClose,
  title,
}: ImagePreviewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = insets.top || initialWindowMetrics?.insets.top || 0;
  const styles = themedStyles(theme);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />

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
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
          >
            <Icon name="x" size={24} color={palette.white} />
          </Pressable>
        </View>

        <View style={styles.previewContainer}>
          {isLoading && !hasError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <SansSerifText size="base" style={styles.loadingText}>
                Loading image…
              </SansSerifText>
            </View>
          )}

          {hasError ? (
            <View style={styles.errorOverlay}>
              <SansSerifText style={styles.errorText}>
                Failed to load image
              </SansSerifText>
              <Pressable onPress={onClose} style={styles.errorButton}>
                <SansSerifText size="base" fontWeight="medium" style={styles.errorButtonText}>
                  Close
                </SansSerifText>
              </Pressable>
            </View>
          ) : (
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="contain"
              onLoadStart={() => {
                setIsLoading(true);
                setHasError(false);
              }}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              accessibilityLabel={title ? `Preview of ${title}` : "Image preview"}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    previewContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.black,
      zIndex: 5,
    },
    loadingText: {
      color: palette.white,
      marginTop: spacing.md,
    },
    errorOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.black,
      zIndex: 5,
    },
    errorText: {
      color: palette.white,
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
    },
  });

const themedStyles = createThemedStyles(createStyles);
