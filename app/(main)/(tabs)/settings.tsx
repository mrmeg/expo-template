import { View, StyleSheet, ScrollView } from "react-native";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { SansSerifText, MonoText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import type { IconName } from "@mrmeg/expo-ui/components/Icon";
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
import { useTranslation } from "react-i18next";
import { setLanguage } from "@/client/features/i18n";
import Config from "@/client/config";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { Seo } from "@/client/components/Seo";

const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
] as const;

function handleLanguageChange(langCode: string) {
  setLanguage(langCode);
}

/**
 * Settings screen - app preferences and configuration.
 */
export default function SettingsRoute() {
  const { theme, scheme } = useTheme();
  const { userTheme, setTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const styles = themedStyles(theme);

  const themeOptions: { value: "system" | "light" | "dark"; label: string; icon: IconName }[] = [
    { value: "system", label: t("settings.theme.system"), icon: "smartphone" },
    { value: "light", label: t("settings.theme.light"), icon: "sun" },
    { value: "dark", label: t("settings.theme.dark"), icon: "moon" },
  ];

  return (
    <>
      <Seo title="Settings - Expo Template" description="Settings screen with theme, language, and preferences." />
      {/* Keep the ScrollView as the screen's first native child — the native
          tab bar finds it via first-subview traversal to drive
          minimizeBehavior and scroll edge effects on iOS 26. */}
      <ScrollView
        testID="settings-screen"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Flat grouped lists: the rows carry the screen's 16pt inset, so
            neither the scroll view nor the groups add horizontal padding. */}
        <ItemGroup
          title={t("settings.appearance")}
          footer={`${t("settings.currentTheme")}: ${scheme}`}
        >
          {themeOptions.map((option) => {
            const isSelected = userTheme === option.value;

            return (
              <Item key={option.value} onPress={() => setTheme(option.value)}>
                <ItemMedia
                  size={36}
                  icon={option.icon}
                  iconColor={isSelected ? theme.colors.primary : theme.colors.foreground}
                  style={isSelected && styles.mediaActive}
                />
                <ItemContent>
                  <ItemTitle>{option.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>

        <ItemGroup title={t("settings.language")} footer={t("settings.languageHint")}>
          {LANGUAGES.map((lang) => {
            const isSelected = i18n.language === lang.code ||
              (i18n.language?.startsWith(lang.code + "-"));

            return (
              <Item key={lang.code} onPress={() => handleLanguageChange(lang.code)}>
                <ItemMedia
                  size={36}
                  icon="globe"
                  iconColor={isSelected ? theme.colors.primary : theme.colors.foreground}
                  style={isSelected && styles.mediaActive}
                />
                <ItemContent>
                  <ItemTitle>{lang.nativeLabel}</ItemTitle>
                  <ItemDescription>{lang.label}</ItemDescription>
                </ItemContent>
                {isSelected && (
                  <ItemActions>
                    <Icon name="check" color={theme.colors.primary} size={20} />
                  </ItemActions>
                )}
              </Item>
            );
          })}
        </ItemGroup>

        <ItemGroup title={t("settings.about")}>
          <Item>
            <ItemContent>
              <ItemTitle>{t("settings.version")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <SansSerifText size="base" style={styles.settingValue}>1.0.0</SansSerifText>
            </ItemActions>
          </Item>
          <Item>
            <ItemContent>
              <ItemTitle>{t("settings.environment")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <SansSerifText size="base" style={styles.settingValue}>
                {__DEV__ ? "Development" : "Production"}
              </SansSerifText>
            </ItemActions>
          </Item>
          <Item>
            <ItemContent>
              <ItemTitle>{t("settings.apiUrl")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <MonoText size="sm" style={styles.settingValue} numberOfLines={1}>
                {/* "" means a native release build without EXPO_PUBLIC_API_URL. */}
                {Config.apiUrl || "—"}
              </MonoText>
            </ItemActions>
          </Item>
        </ItemGroup>
      </ScrollView>
    </>
  );
}

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.sectionSpacing,
    },
    mediaActive: {
      // eslint-disable-next-line expo-ui/no-restyle -- colored icon tile; ItemMedia has no tint variant
      backgroundColor: withAlpha(theme.colors.primary, 0.13),
    },
    settingValue: {
      color: theme.colors.mutedForeground,
      maxWidth: 180,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: spacing.radiusFull,
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
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.primary,
    },
  });

const themedStyles = createThemedStyles(createStyles);
