import React, { useState } from "react";
import { View, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { ErrorScreen, type ErrorVariant } from "@/client/screens/ErrorScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

const VARIANTS: { key: ErrorVariant; label: string }[] = [
  { key: "not-found", label: "Not Found" },
  { key: "offline", label: "Offline" },
  { key: "maintenance", label: "Maintenance" },
  { key: "permission-denied", label: "Permission" },
  { key: "generic", label: "Generic" },
];

export default function ScreenErrorDemo() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [variant, setVariant] = useState<ErrorVariant>("generic");

  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {VARIANTS.map((v) => {
          const isActive = v.key === variant;
          return (
            <Pressable
              key={v.key}
              onPress={() => setVariant(v.key)}
              style={[
                styles.tab,
                isActive && { backgroundColor: theme.colors.primary },
              ]}
            >
              <SansSerifText
                style={[
                  styles.tabText,
                  isActive && { color: theme.colors.primaryForeground },
                ]}
              >
                {v.label}
              </SansSerifText>
            </Pressable>
          );
        })}
      </View>

      <ErrorScreen
        variant={variant}
        estimatedReturn={variant === "maintenance" ? "Back by 3:00 PM EST" : undefined}
        primaryAction={{
          label: "Try Again",
          onPress: () => showAlert(`Retry action for "${variant}"`),
        }}
        secondaryAction={{
          label: "Go Home",
          onPress: () => showAlert("Navigate home"),
        }}
        style={styles.screen}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabBar: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusMd,
    },
    tabText: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    screen: {
      flex: 1,
    },
  });
