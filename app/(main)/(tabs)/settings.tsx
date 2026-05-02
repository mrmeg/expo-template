import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import type { IconName } from "@mrmeg/expo-ui/components/Icon";
import { useTranslation } from "react-i18next";
import { setLanguage } from "@/client/features/i18n";
import Config from "@/client/config";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { SEO } from "@/client/components/SEO";

const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
] as const;

/**
 * Settings screen - app preferences and configuration.
 */
export default function SettingsRoute() {
  const { theme, scheme, getShadowStyle } = useTheme();
  const { userTheme, setTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const styles = createStyles(theme);

  const themeOptions: { value: "system" | "light" | "dark"; label: string; icon: IconName }[] = [
    { value: "system", label: t("settings.theme.system"), icon: "smartphone" },
    { value: "light", label: t("settings.theme.light"), icon: "sun" },
    { value: "dark", label: t("settings.theme.dark"), icon: "moon" },
  ];

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
  };

  return (
    <View style={styles.container}>
      <SEO title="Settings - Expo Template" description="Settings screen with theme, language, and preferences." />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            {t("settings.appearance")}
          </SansSerifBoldText>

          <View style={[styles.card, getShadowStyle("subtle")]}>
            {themeOptions.map((option, index) => {
              const isSelected = userTheme === option.value;
              const isLast = index === themeOptions.length - 1;

              return (
                <View key={option.value}>
                  <Pressable
                    style={[
                      styles.settingRow,
                      Platform.OS === "web" && { cursor: "pointer" as any },
                    ]}
                    onPress={() => setTheme(option.value)}
                  >
                    <View style={styles.settingLeft}>
                      <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
                        <Icon
                          name={option.icon}
                          color={isSelected ? theme.colors.primary : theme.colors.foreground}
                          size={20}
                        />
                      </View>
                      <SansSerifText style={styles.settingLabel}>
                        {option.label}
                      </SansSerifText>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          <SansSerifText style={styles.hint}>
            {t("settings.currentTheme")}: {scheme}
          </SansSerifText>
        </View>

        {/* Language section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            {t("settings.language")}
          </SansSerifBoldText>

          <View style={[styles.card, getShadowStyle("subtle")]}>
            {LANGUAGES.map((lang, index) => {
              const isSelected = i18n.language === lang.code ||
                (i18n.language?.startsWith(lang.code + "-"));
              const isLast = index === LANGUAGES.length - 1;

              return (
                <View key={lang.code}>
                  <Pressable
                    style={[
                      styles.settingRow,
                      Platform.OS === "web" && { cursor: "pointer" as any },
                    ]}
                    onPress={() => handleLanguageChange(lang.code)}
                  >
                    <View style={styles.settingLeft}>
                      <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
                        <Icon
                          name="globe"
                          color={isSelected ? theme.colors.primary : theme.colors.foreground}
                          size={20}
                        />
                      </View>
                      <View>
                        <SansSerifText style={styles.settingLabel}>
                          {lang.nativeLabel}
                        </SansSerifText>
                        <SansSerifText style={styles.settingSubLabel}>
                          {lang.label}
                        </SansSerifText>
                      </View>
                    </View>
                    {isSelected && (
                      <Icon name="check" color={theme.colors.primary} size={20} />
                    )}
                  </Pressable>
                  {!isLast && <View style={styles.dividerFull} />}
                </View>
              );
            })}
          </View>

          <SansSerifText style={styles.hint}>
            {t("settings.languageHint")}
          </SansSerifText>
        </View>

        {/* About section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            {t("settings.about")}
          </SansSerifBoldText>

          <View style={[styles.card, getShadowStyle("subtle")]}>
            <View style={styles.settingRow}>
              <SansSerifText style={styles.settingLabel}>{t("settings.version")}</SansSerifText>
              <SansSerifText style={styles.settingValue}>1.0.0</SansSerifText>
            </View>
            <View style={styles.dividerFull} />
            <View style={styles.settingRow}>
              <SansSerifText style={styles.settingLabel}>{t("settings.environment")}</SansSerifText>
              <SansSerifText style={styles.settingValue}>
                {__DEV__ ? "Development" : "Production"}
              </SansSerifText>
            </View>
            <View style={styles.dividerFull} />
            <View style={styles.settingRow}>
              <SansSerifText style={styles.settingLabel}>{t("settings.apiUrl")}</SansSerifText>
              <SansSerifText style={[styles.settingValue, styles.mono]} numberOfLines={1}>
                {Config.apiUrl}
              </SansSerifText>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    iconContainerActive: {
      backgroundColor: theme.colors.primary + "20",
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    settingSubLabel: {
      fontSize: 12,
      color: theme.colors.foreground,
      opacity: 0.5,
      marginTop: 2,
    },
    settingValue: {
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.6,
      maxWidth: 180,
    },
    mono: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md + 36 + spacing.md,
    },
    dividerFull: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.foreground,
      opacity: 0.5,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
  });
