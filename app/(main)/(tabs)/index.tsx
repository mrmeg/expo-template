import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { save, load, remove } from "@/client/utils/storage";
import { Database, Trash2, Globe, Palette, Wrench, Cloud, RefreshCw, ClipboardList } from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";

const STORAGE_TEST_KEY = "demo-storage-test";

// Types for React Query demo
interface RandomUser {
  id: number;
  name: string;
  email: string;
  company: { name: string };
}

// Fetch function for React Query demo
async function fetchRandomUser(): Promise<RandomUser> {
  const randomId = Math.floor(Math.random() * 10) + 1;
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/users/${randomId}`
  );
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
}

/**
 * Home screen - main landing page with feature demos.
 */
export default function HomeScreen() {
  const { theme, getShadowStyle } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = createStyles(theme);

  // React Query demo
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
    isFetching: userFetching,
  } = useQuery({
    queryKey: ["randomUser"],
    queryFn: fetchRandomUser,
    enabled: false, // Don't fetch on mount, only when refetch is called
  });

  // Storage demo state
  const [storageValue, setStorageValue] = useState<string | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const handleStorageSave = async () => {
    setStorageLoading(true);
    const testData = { timestamp: new Date().toISOString(), demo: true };
    await save(STORAGE_TEST_KEY, testData);
    setStorageValue(JSON.stringify(testData, null, 2));
    setStorageLoading(false);
  };

  const handleStorageLoad = async () => {
    setStorageLoading(true);
    const data = await load(STORAGE_TEST_KEY);
    setStorageValue(data ? JSON.stringify(data, null, 2) : "No data found");
    setStorageLoading(false);
  };

  const handleStorageClear = async () => {
    setStorageLoading(true);
    await remove(STORAGE_TEST_KEY);
    setStorageValue(null);
    setStorageLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome section */}
        <View style={[styles.welcomeCard, getShadowStyle("soft")]}>
          <SansSerifBoldText style={styles.greeting}>
            {t("home.title")}
          </SansSerifBoldText>
          <SansSerifText style={styles.welcomeText}>
            {t("home.welcomeMessage")}
          </SansSerifText>
        </View>

        {/* Feature Demos */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            Feature Demos
          </SansSerifBoldText>

          {/* i18n Demo */}
          <View style={[styles.demoCard, getShadowStyle("subtle")]}>
            <View style={styles.demoHeader}>
              <Icon as={Globe} color={theme.colors.primary} size={20} />
              <SansSerifBoldText style={styles.demoTitle}>
                Internationalization
              </SansSerifBoldText>
            </View>
            <SansSerifText style={styles.demoDescription}>
              Current language: <SansSerifBoldText>{i18n.language === "en" ? "English" : "Español"}</SansSerifBoldText>
            </SansSerifText>

            {/* Interpolation demo */}
            <View style={styles.i18nExample}>
              <SansSerifText style={styles.i18nLabel}>Interpolation:</SansSerifText>
              <SansSerifText style={styles.i18nValue}>
                {t("home.greeting", { name: "Developer" })}
              </SansSerifText>
            </View>

            <View style={styles.i18nExample}>
              <SansSerifText style={styles.i18nLabel}>Date formatting:</SansSerifText>
              <SansSerifText style={styles.i18nValue}>
                {t("profile.memberSince", { date: new Date().toLocaleDateString(i18n.language) })}
              </SansSerifText>
            </View>

            <SansSerifText style={styles.demoHint}>
              Change language in Settings tab
            </SansSerifText>
          </View>

          {/* Storage Demo */}
          <View style={[styles.demoCard, getShadowStyle("subtle")]}>
            <View style={styles.demoHeader}>
              <Icon as={Database} color={theme.colors.primary} size={20} />
              <SansSerifBoldText style={styles.demoTitle}>
                Storage Utilities
              </SansSerifBoldText>
            </View>
            <SansSerifText style={styles.demoDescription}>
              Cross-platform AsyncStorage abstraction
            </SansSerifText>

            <View style={styles.buttonRow}>
              <Button
                preset="default"
                size="sm"
                onPress={handleStorageSave}
                disabled={storageLoading}
                style={styles.smallButton}
              >
                <SansSerifText style={styles.buttonTextLight}>Save</SansSerifText>
              </Button>
              <Button
                preset="outline"
                size="sm"
                onPress={handleStorageLoad}
                disabled={storageLoading}
                style={styles.smallButton}
              >
                <SansSerifText style={styles.buttonText}>Load</SansSerifText>
              </Button>
              <Button
                preset="ghost"
                size="sm"
                onPress={handleStorageClear}
                disabled={storageLoading}
                style={styles.smallButton}
              >
                <Icon as={Trash2} color={theme.colors.destructive} size={16} />
              </Button>
            </View>

            {storageValue && (
              <View style={styles.resultBox}>
                <SansSerifText style={[styles.resultText, styles.mono]}>
                  {storageValue}
                </SansSerifText>
              </View>
            )}
          </View>

          {/* Theme Demo */}
          <View style={[styles.demoCard, getShadowStyle("subtle")]}>
            <View style={styles.demoHeader}>
              <Icon as={Palette} color={theme.colors.primary} size={20} />
              <SansSerifBoldText style={styles.demoTitle}>
                Theming System
              </SansSerifBoldText>
            </View>
            <SansSerifText style={styles.demoDescription}>
              Dynamic colors, shadows, and contrast utilities
            </SansSerifText>
            <View style={styles.colorRow}>
              {["primary", "secondary", "success", "warning", "destructive"].map((color) => (
                <View
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: theme.colors[color as keyof typeof theme.colors] },
                  ]}
                />
              ))}
            </View>
            <SansSerifText style={styles.demoHint}>
              Toggle theme in Settings tab
            </SansSerifText>
          </View>

          {/* React Query Demo */}
          <View style={[styles.demoCard, getShadowStyle("subtle")]}>
            <View style={styles.demoHeader}>
              <Icon as={Cloud} color={theme.colors.primary} size={20} />
              <SansSerifBoldText style={styles.demoTitle}>
                React Query
              </SansSerifBoldText>
            </View>
            <SansSerifText style={styles.demoDescription}>
              Server state management with caching and refetching
            </SansSerifText>

            <Button
              preset="outline"
              size="sm"
              onPress={() => refetchUser()}
              loading={userFetching}
              fullWidth
              style={styles.fetchButton}
            >
              <Icon as={RefreshCw} color={theme.colors.primary} size={14} />
              <SansSerifText style={styles.buttonText}>
                {" "}Fetch Random User
              </SansSerifText>
            </Button>

            {userError && (
              <View style={[styles.resultBox, styles.errorBox]}>
                <SansSerifText style={styles.errorText}>
                  Error: {(userError as Error).message}
                </SansSerifText>
              </View>
            )}

            {user && !userFetching && (
              <View style={styles.resultBox}>
                <SansSerifBoldText style={styles.userName}>{user.name}</SansSerifBoldText>
                <SansSerifText style={styles.userDetail}>{user.email}</SansSerifText>
                <SansSerifText style={styles.userDetail}>{user.company.name}</SansSerifText>
              </View>
            )}

            <SansSerifText style={styles.demoHint}>
              Data is cached and automatically refetched
            </SansSerifText>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            {t("home.quickActions")}
          </SansSerifBoldText>

          <Link href="/(main)/showcase" asChild>
            <Button preset="outline" fullWidth style={styles.actionButton}>
              <SansSerifText style={styles.actionButtonText}>
                {t("home.viewComponents")}
              </SansSerifText>
            </Button>
          </Link>

          <Link href="/(main)/form-demo" asChild>
            <Button preset="outline" fullWidth style={styles.actionButton}>
              <Icon as={ClipboardList} color={theme.colors.primary} size={16} />
              <SansSerifText style={styles.actionButtonText}>
                {" "}Form Validation Demo
              </SansSerifText>
            </Button>
          </Link>

          <Link href="/(main)/developer" asChild>
            <Button preset="ghost" fullWidth style={styles.actionButton}>
              <Icon as={Wrench} color={theme.colors.mutedForeground} size={16} />
              <SansSerifText style={styles.devButtonText}>
                {" "}Developer Tools
              </SansSerifText>
            </Button>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    welcomeCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: spacing.radiusLg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    greeting: {
      fontSize: 24,
      color: theme.colors.primaryForeground,
      marginBottom: spacing.xs,
    },
    welcomeText: {
      fontSize: 16,
      color: theme.colors.primaryForeground,
      opacity: 0.9,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      color: theme.colors.foreground,
      marginBottom: spacing.md,
    },
    demoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: spacing.md,
    },
    demoHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    demoTitle: {
      fontSize: 16,
      color: theme.colors.foreground,
      marginLeft: spacing.sm,
    },
    demoDescription: {
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.7,
      marginBottom: spacing.sm,
    },
    demoHint: {
      fontSize: 12,
      color: theme.colors.foreground,
      opacity: 0.5,
      fontStyle: "italic",
    },
    i18nExample: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xs,
      flexWrap: "wrap",
    },
    i18nLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      marginRight: spacing.xs,
    },
    i18nValue: {
      fontSize: 13,
      color: theme.colors.foreground,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    smallButton: {
      flex: 1,
    },
    buttonText: {
      color: theme.colors.primary,
    },
    buttonTextLight: {
      color: theme.colors.primaryForeground,
    },
    resultBox: {
      backgroundColor: theme.colors.muted,
      borderRadius: spacing.radiusSm,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    resultText: {
      fontSize: 12,
      color: theme.colors.foreground,
      flex: 1,
    },
    mono: {
      fontFamily: "monospace",
    },
    colorRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: spacing.radiusSm,
    },
    fetchButton: {
      marginBottom: spacing.sm,
    },
    errorBox: {
      backgroundColor: theme.colors.destructive + "15",
      borderWidth: 1,
      borderColor: theme.colors.destructive,
    },
    errorText: {
      color: theme.colors.destructive,
      fontSize: 12,
    },
    userName: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    userDetail: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    actionButton: {
      marginBottom: spacing.sm,
    },
    actionButtonText: {
      color: theme.colors.primary,
    },
    devButtonText: {
      color: theme.colors.mutedForeground,
    },
  });
