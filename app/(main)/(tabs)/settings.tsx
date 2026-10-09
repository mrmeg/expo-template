import { StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, MonoText } from "@mrmeg/expo-ui/components/StyledText";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@mrmeg/expo-ui/components/Item";
import { ThemeSelector } from "@mrmeg/expo-ui/components/ThemeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mrmeg/expo-ui/components/Select";
import { Hydrated } from "@mrmeg/expo-ui/components/Hydrated";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { useTranslation } from "react-i18next";
import { setLanguage } from "@/client/features/i18n";
import Config from "@/client/config";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { Seo } from "@/client/components/Seo";
import { useTabHeaderTitle } from "@/client/features/navigation/tabTitle";

// Each language is labelled in its own language, so it stays findable whatever
// the app is currently set to.
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

/**
 * Settings screen - app preferences and configuration.
 */
export default function SettingsRoute() {
  useTabHeaderTitle("settings");
  const { theme, scheme } = useTheme();
  const userTheme = useThemeStore((state) => state.userTheme);
  const { t, i18n } = useTranslation();
  const styles = themedStyles(theme);

  const language =
    LANGUAGES.find((lang) => i18n.language === lang.value || i18n.language?.startsWith(lang.value + "-")) ??
    LANGUAGES[0];

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
            neither the scroll view nor the groups add horizontal padding.
            Each preference is one row with its control trailing. */}
        <ItemGroup title={t("settings.preferences")}>
          <Item>
            <ItemContent>
              <ItemTitle>{t("settings.themeTitle")}</ItemTitle>
              {userTheme === "system" && (
                <ItemDescription>
                  {t("settings.matchesDevice", { scheme: t(`settings.theme.${scheme}`) })}
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <ThemeSelector
                labels={{
                  system: t("settings.theme.system"),
                  light: t("settings.theme.light"),
                  dark: t("settings.theme.dark"),
                }}
              />
            </ItemActions>
          </Item>
          <Item>
            <ItemContent>
              <ItemTitle>{t("settings.language")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              {/* The Radix-backed Select mints useId()s the server can't
                  reproduce; render it after hydration. */}
              <Hydrated fallback={<SansSerifText size="base" style={styles.settingValue}>{language.label}</SansSerifText>}>
                <Select value={language} onValueChange={(option) => option && setLanguage(option.value)}>
                  <SelectTrigger size="sm" accessibilityLabel={t("settings.language")}>
                    <SelectValue placeholder={language.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} label={lang.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Hydrated>
            </ItemActions>
          </Item>
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
    settingValue: {
      color: theme.colors.mutedForeground,
      maxWidth: 180,
    },
  });

const themedStyles = createThemedStyles(createStyles);
