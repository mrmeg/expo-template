import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing, type Theme } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

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
  const styles = useMemo(() => createStyles(theme, topInset), [theme, topInset]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [visible, uri]);

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

        <View style={styles.header}>
          <View style={styles.headerContent}>
            {title && (
              <SansSerifText style={styles.title} numberOfLines={1}>
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
            <Icon name="x" size={24} color="white" />
          </Pressable>
        </View>

        <View style={styles.previewContainer}>
          {isLoading && !hasError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <SansSerifText style={styles.loadingText}>
                Loading image...
              </SansSerifText>
            </View>
          )}

          {hasError ? (
            <View style={styles.errorOverlay}>
              <SansSerifText style={styles.errorText}>
                Failed to load image
              </SansSerifText>
              <Pressable onPress={onClose} style={styles.errorButton}>
                <SansSerifText style={styles.errorButtonText}>
                  Close
                </SansSerifText>
              </Pressable>
            </View>
          ) : (
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setIsLoading(true)}
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
