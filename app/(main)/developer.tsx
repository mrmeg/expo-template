import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import {
  SansSerifText,
  SansSerifBoldText,
} from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import {
  Settings,
  Database,
  Bug,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react-native";
import Config from "@/client/config";
import { getAllKeys, load, clear } from "@/client/utils/storage";
import type { Theme } from "@/client/constants/colors";
import Constants from "expo-constants";

/**
 * Developer tools screen - shows config, environment, storage, and debugging tools.
 * Only visible in development mode in a real app.
 */
export default function DeveloperScreen() {
  const { theme, scheme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  // Storage state
  const [storageKeys, setStorageKeys] = useState<string[]>([]);
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});
  const [storageLoading, setStorageLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Error trigger state
  const [shouldError, setShouldError] = useState(false);

  // Refresh storage keys
  const refreshStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const keys = await getAllKeys();
      setStorageKeys([...keys]);

      // Load all values
      const data: Record<string, unknown> = {};
      for (const key of keys) {
        data[key] = await load(key);
      }
      setStorageData(data);
    } catch (error) {
      console.error("Failed to load storage:", error);
    }
    setStorageLoading(false);
  }, []);

  // Clear all storage
  const clearStorage = useCallback(async () => {
    setStorageLoading(true);
    await clear();
    setStorageKeys([]);
    setStorageData({});
    setStorageLoading(false);
  }, []);

  // Trigger an error to test ErrorBoundary
  if (shouldError) {
    throw new Error("Test error triggered from Developer screen");
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Environment Info */}
        <View style={[styles.section, getShadowStyle("subtle")]}>
          <View style={styles.sectionHeader}>
            <Icon as={Settings} color={theme.colors.primary} size={20} />
            <SansSerifBoldText style={styles.sectionTitle}>
              Environment
            </SansSerifBoldText>
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="Mode" value={__DEV__ ? "Development" : "Production"} />
            <InfoRow label="Platform" value={Platform.OS} />
            <InfoRow label="Version" value={Platform.Version?.toString() ?? "N/A"} />
            <InfoRow label="Theme" value={scheme ?? "system"} />
            <InfoRow
              label="Expo SDK"
              value={Constants.expoConfig?.sdkVersion ?? "N/A"}
            />
            <InfoRow
              label="App Version"
              value={Constants.expoConfig?.version ?? "N/A"}
            />
          </View>
        </View>

        {/* Configuration */}
        <View style={[styles.section, getShadowStyle("subtle")]}>
          <View style={styles.sectionHeader}>
            <Icon as={Settings} color={theme.colors.primary} size={20} />
            <SansSerifBoldText style={styles.sectionTitle}>
              Configuration
            </SansSerifBoldText>
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="API URL" value={Config.apiUrl || "(not set)"} />
            <InfoRow label="API Timeout" value={`${Config.apiTimeout}ms`} />
            <InfoRow label="Persist Navigation" value={Config.persistNavigation} />
            <InfoRow label="Catch Errors" value={Config.catchErrors} />
            <InfoRow label="Exit Routes" value={Config.exitRoutes.join(", ")} />
          </View>
        </View>

        {/* Storage Inspector */}
        <View style={[styles.section, getShadowStyle("subtle")]}>
          <View style={styles.sectionHeader}>
            <Icon as={Database} color={theme.colors.primary} size={20} />
            <SansSerifBoldText style={styles.sectionTitle}>
              Storage Inspector
            </SansSerifBoldText>
          </View>

          <View style={styles.buttonRow}>
            <Button
              preset="outline"
              size="sm"
              onPress={refreshStorage}
              disabled={storageLoading}
              style={styles.flex1}
            >
              <Icon as={RefreshCw} color={theme.colors.primary} size={14} />
              <SansSerifText style={styles.buttonText}> Refresh</SansSerifText>
            </Button>
            <Button
              preset="destructive"
              size="sm"
              onPress={clearStorage}
              disabled={storageLoading || storageKeys.length === 0}
              style={styles.flex1}
            >
              <Icon as={Trash2} color={theme.colors.destructiveForeground} size={14} />
              <SansSerifText style={styles.buttonTextLight}> Clear All</SansSerifText>
            </Button>
          </View>

          {storageKeys.length === 0 ? (
            <View style={styles.emptyState}>
              <SansSerifText style={styles.emptyText}>
                {storageLoading ? "Loading..." : "No data in storage. Tap Refresh to scan."}
              </SansSerifText>
            </View>
          ) : (
            <View style={styles.storageList}>
              {storageKeys.map((key) => (
                <Pressable
                  key={key}
                  style={styles.storageItem}
                  onPress={() => setExpandedKey(expandedKey === key ? null : key)}
                >
                  <View style={styles.storageItemHeader}>
                    <Icon
                      as={expandedKey === key ? ChevronDown : ChevronRight}
                      color={theme.colors.mutedForeground}
                      size={16}
                    />
                    <SansSerifText style={styles.storageKey} numberOfLines={1}>
                      {key}
                    </SansSerifText>
                  </View>
                  {expandedKey === key && (
                    <View style={styles.storageValue}>
                      <SansSerifText style={styles.storageValueText}>
                        {JSON.stringify(storageData[key], null, 2)}
                      </SansSerifText>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Debug Tools */}
        <View style={[styles.section, getShadowStyle("subtle")]}>
          <View style={styles.sectionHeader}>
            <Icon as={Bug} color={theme.colors.primary} size={20} />
            <SansSerifBoldText style={styles.sectionTitle}>
              Debug Tools
            </SansSerifBoldText>
          </View>

          <SansSerifText style={styles.debugDescription}>
            Test the ErrorBoundary by triggering a controlled error.
          </SansSerifText>

          <Button
            preset="destructive"
            onPress={() => setShouldError(true)}
            fullWidth
          >
            <Icon as={AlertTriangle} color={theme.colors.destructiveForeground} size={16} />
            <SansSerifBoldText style={styles.buttonTextLight}>
              {" "}Trigger Test Error
            </SansSerifBoldText>
          </Button>

          <SansSerifText style={styles.debugHint}>
            The ErrorBoundary will catch this and show the error screen.
            Use the "Try Again" button to reset.
          </SansSerifText>

          {__DEV__ && (
            <View style={styles.reactotronNote}>
              <SansSerifBoldText style={styles.reactotronTitle}>
                Reactotron
              </SansSerifBoldText>
              <SansSerifText style={styles.reactotronText}>
                Reactotron is enabled in development. Open the Reactotron app to see logs,
                network requests, and AsyncStorage data.
              </SansSerifText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper component for info rows
function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={infoRowStyles.row}>
      <SansSerifText style={[infoRowStyles.label, { color: theme.colors.mutedForeground }]}>
        {label}
      </SansSerifText>
      <SansSerifText
        style={[infoRowStyles.value, { color: theme.colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </SansSerifText>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: spacing.md,
  },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.colors.foreground,
      marginLeft: spacing.sm,
    },
    infoGrid: {
      gap: spacing.xs,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    flex1: {
      flex: 1,
    },
    buttonText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    buttonTextLight: {
      color: theme.colors.destructiveForeground,
      fontSize: 14,
    },
    emptyState: {
      padding: spacing.lg,
      alignItems: "center",
    },
    emptyText: {
      color: theme.colors.mutedForeground,
      fontSize: 14,
      textAlign: "center",
    },
    storageList: {
      gap: spacing.xs,
    },
    storageItem: {
      backgroundColor: theme.colors.muted,
      borderRadius: spacing.radiusSm,
      padding: spacing.sm,
    },
    storageItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    storageKey: {
      fontSize: 13,
      color: theme.colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      flex: 1,
    },
    storageValue: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: spacing.radiusSm,
    },
    storageValueText: {
      fontSize: 11,
      color: theme.colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    debugDescription: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      marginBottom: spacing.md,
    },
    debugHint: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginTop: spacing.sm,
      fontStyle: "italic",
    },
    reactotronNote: {
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: theme.colors.muted,
      borderRadius: spacing.radiusSm,
    },
    reactotronTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    reactotronText: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      lineHeight: 18,
    },
  });
