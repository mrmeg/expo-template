import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { useThemeStore } from "@/client/stores/themeStore";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import { Sun, Moon, Smartphone, Globe, ChevronRight, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Config from "@/client/config";
import type { Theme } from "@/client/constants/colors";

const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
] as const;

/**
 * Settings screen - app preferences and configuration.
 */
export default function SettingsScreen() {
  const { theme, scheme, getShadowStyle } = useTheme();
  const { userTheme, setTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const styles = createStyles(theme);

  const themeOptions = [
    { value: "system", label: t("settings.theme.system"), icon: Smartphone },
    { value: "light", label: t("settings.theme.light"), icon: Sun },
    { value: "dark", label: t("settings.theme.dark"), icon: Moon },
  ] as const;

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
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
                          as={option.icon}
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
                          as={Globe}
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
                      <Icon as={Check} color={theme.colors.primary} size={20} />
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
