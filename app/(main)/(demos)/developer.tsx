import { useReducer, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import {
  SansSerifText,
  SansSerifBoldText,
  MonoText,
} from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@mrmeg/expo-ui/components/Item";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import Config from "@/client/config";
import { getAllKeys, load, clear } from "@/client/lib/storage";
import type { Theme } from "@mrmeg/expo-ui/constants";
import Constants from "expo-constants";

type StorageState = {
  keys: string[];
  data: Record<string, unknown>;
  loading: boolean;
  expandedKey: string | null;
};

type StorageAction =
  | { type: "loading"; loading: boolean }
  | { type: "loaded"; keys: string[]; data: Record<string, unknown> }
  | { type: "cleared" }
  | { type: "toggleExpanded"; key: string };

const INITIAL_STORAGE_STATE: StorageState = {
  keys: [],
  data: {},
  loading: false,
  expandedKey: null,
};

function storageReducer(state: StorageState, action: StorageAction): StorageState {
  switch (action.type) {
  case "loading":
    return { ...state, loading: action.loading };
  case "loaded":
    return {
      ...state,
      keys: action.keys,
      data: action.data,
      loading: false,
    };
  case "cleared":
    return INITIAL_STORAGE_STATE;
  case "toggleExpanded":
    return {
      ...state,
      expandedKey: state.expandedKey === action.key ? null : action.key,
    };
  }
}

/**
 * Developer tools screen - shows config, environment, storage, and debugging tools.
 * Only visible in development mode in a real app.
 */
export default function DeveloperScreen() {
  const { theme, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = themedStyles(theme);

  // Storage state
  const [storage, dispatchStorage] = useReducer(
    storageReducer,
    INITIAL_STORAGE_STATE
  );
  const {
    keys: storageKeys,
    data: storageData,
    loading: storageLoading,
    expandedKey,
  } = storage;

  // Error trigger state
  const [errorTriggerCount, triggerError] = useReducer((count: number) => count + 1, 0);

  // Refresh storage keys
  const refreshStorage = useCallback(async () => {
    dispatchStorage({ type: "loading", loading: true });
    try {
      const keys = await getAllKeys();

      // Load all values
      const entries = await Promise.all(
        keys.map(async (key) => [key, await load(key)] as const)
      );
      const data = Object.fromEntries(entries);
      dispatchStorage({ type: "loaded", keys: [...keys], data });
    } catch (error) {
      console.error("Failed to load storage:", error);
      dispatchStorage({ type: "loading", loading: false });
    }
  }, []);

  // Clear all storage
  const clearStorage = useCallback(async () => {
    dispatchStorage({ type: "loading", loading: true });
    await clear();
    dispatchStorage({ type: "cleared" });
  }, []);

  // Trigger an error to test ErrorBoundary
  if (errorTriggerCount > 0) {
    throw new Error("Test error triggered from Developer screen");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.lg + insets.bottom },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Flat grouped lists: the rows carry the screen's 16pt inset, so the
          scroll view adds none and only free-form blocks pad themselves. */}
      <ItemGroup title="Environment">
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
      </ItemGroup>

      <ItemGroup title="Configuration">
        <InfoRow label="API URL" value={Config.apiUrl || "(not set)"} />
        <InfoRow label="Catch Errors" value={Config.catchErrors} />
      </ItemGroup>

      {/* The button row sits in the group's first row slot; it is not an Item,
          so no hairline is drawn under it. */}
      <ItemGroup
        title="Storage Inspector"
        footer={
          storageKeys.length === 0
            ? storageLoading
              ? "Loading..."
              : "No data in storage. Tap Refresh to scan."
            : undefined
        }
      >
        <View style={styles.buttonRow}>
          <Button
            preset="outline"
            size="sm"
            onPress={refreshStorage}
            disabled={storageLoading}
            style={styles.flex1}
          >
            <Icon name="refresh-cw" color={theme.colors.primary} size={14} />
            <SansSerifText size="base" style={styles.buttonText}> Refresh</SansSerifText>
          </Button>
          <Button
            preset="destructive"
            size="sm"
            onPress={clearStorage}
            disabled={storageLoading || storageKeys.length === 0}
            style={styles.flex1}
          >
            <Icon name="trash" color={theme.colors.destructiveForeground} size={14} />
            <SansSerifText size="base" style={styles.buttonTextLight}> Clear All</SansSerifText>
          </Button>
        </View>
        {storageKeys.map((key) => (
          <Item
            key={key}
            onPress={() => dispatchStorage({ type: "toggleExpanded", key })}
          >
            <ItemContent>
              <View style={styles.storageKeyRow}>
                <Icon
                  name={expandedKey === key ? "chevron-down" : "chevron-right"}
                  color={theme.colors.mutedForeground}
                  size={16}
                />
                <MonoText size="sm" style={styles.storageKey} numberOfLines={1}>
                  {key}
                </MonoText>
              </View>
              {expandedKey === key && (
                <MonoText size="xs" style={styles.storageValueText}>
                  {JSON.stringify(storageData[key], null, 2)}
                </MonoText>
              )}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>

      <ItemGroup title="Auth Demo">
        <Item onPress={() => router.push("/(main)/(demos)/auth-demo")}>
          <ItemMedia size={36} icon="lock" iconColor={theme.colors.primary} />
          <ItemContent>
            <ItemTitle>Open Auth Demo</ItemTitle>
            <ItemDescription>
              Test the authentication flow with Cognito integration.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" size={18} color={theme.colors.mutedForeground} />
          </ItemActions>
        </Item>
      </ItemGroup>

      <ItemGroup
        title="Debug Tools"
        footer={"The ErrorBoundary will catch this and show the error screen. Use the \"Try Again\" button to reset."}
      >
        <Item onPress={triggerError}>
          <ItemMedia
            size={36}
            icon="triangle-alert"
            iconColor={theme.colors.destructive}
            style={styles.destructiveTile}
          />
          <ItemContent>
            <ItemTitle style={styles.destructiveLabel}>Trigger Test Error</ItemTitle>
            <ItemDescription>
              Test the ErrorBoundary by triggering a controlled error.
            </ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>

      {__DEV__ && (
        <View style={styles.reactotronNote}>
          <SansSerifBoldText size="base" style={styles.reactotronTitle}>
            Reactotron
          </SansSerifBoldText>
          <SansSerifText size="sm" style={styles.reactotronText}>
            Reactotron is enabled in development. Open the Reactotron app to see logs,
            network requests, and AsyncStorage data.
          </SansSerifText>
        </View>
      )}
    </ScrollView>
  );
}

// Helper component for label/value rows
function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <Item>
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
      </ItemContent>
      <ItemActions>
        <SansSerifText size="base" style={styles.infoValue} numberOfLines={1}>
          {value}
        </SansSerifText>
      </ItemActions>
    </Item>
  );
}

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.md,
      gap: spacing.sectionSpacing,
    },
    infoValue: {
      color: theme.colors.mutedForeground,
      maxWidth: 180,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.xs,
    },
    flex1: {
      flex: 1,
    },
    buttonText: {
      color: theme.colors.primary,
    },
    buttonTextLight: {
      color: theme.colors.destructiveForeground,
    },
    storageKeyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    storageKey: {
      color: theme.colors.foreground,
      flex: 1,
    },
    storageValueText: {
      color: theme.colors.mutedForeground,
    },
    destructiveTile: {
      // eslint-disable-next-line expo-ui/no-restyle -- destructive icon tile tint; ItemMedia has no tint variant
      backgroundColor: withAlpha(theme.colors.destructive, 0.12),
    },
    destructiveLabel: {
      color: theme.colors.destructive,
    },
    reactotronNote: {
      paddingHorizontal: spacing.screenPadding,
    },
    reactotronTitle: {
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    reactotronText: {
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
