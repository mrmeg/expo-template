/**
 * Internationalization setup using i18next and expo-localization.
 *
 * Features:
 * - Auto-detects device locale
 * - Falls back to English if locale not supported
 * - RTL support for languages like Arabic
 * - Type-safe translation keys
 * - Non-default locales loaded lazily to reduce initial bundle
 */

import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import "intl-pluralrules";

import en, { type Translations } from "./en";
import { useLanguageStore } from "@/client/stores/languageStore";

// Default/fallback locale
const fallbackLocale = "en";

// Supported language tags (add new locales here)
const supportedTags = ["en", "es"];

// Get device locales
const systemLocales = Localization.getLocales();

/**
 * Check if a device language tag matches a supported language
 */
function matchesSupportedLanguage(deviceTag: string): boolean {
  const primaryTag = deviceTag.split("-")[0];
  return supportedTags.includes(primaryTag);
}

/**
 * Find the first supported locale from device locales
 */
function pickSupportedLocale(): Localization.Locale | undefined {
  return systemLocales.find((locale) =>
    matchesSupportedLanguage(locale.languageTag)
  );
}

// Get the best matching locale
const locale = pickSupportedLocale();

/**
 * Whether the app should use RTL layout
 */
export const isRTL = locale?.textDirection === "rtl";

// Configure RTL early (before React renders)
if (locale?.textDirection === "rtl") {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} else {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

/**
 * Dynamically load a locale's translations
 */
async function loadLocale(lang: string): Promise<Record<string, any> | null> {
  switch (lang) {
  case "es":
    return (await import("./es")).default;
  default:
    return null;
  }
}

/**
 * Initialize i18n - call this before rendering the app.
 * Restores a saved language preference, or falls back to device locale.
 */
export async function initI18n(): Promise<typeof i18n> {
  // Check for a persisted language preference
  const savedLang = await useLanguageStore.getState().loadLanguage();
  const detectedLang = locale?.languageTag.split("-")[0] ?? fallbackLocale;
  const initialLang = savedLang && supportedTags.includes(savedLang) ? savedLang : detectedLang;

  // Start with English (always bundled)
  const resources: Record<string, { translation: any }> = {
    en: { translation: en },
  };

  // Lazy-load non-default locale if needed
  if (initialLang !== "en") {
    const translations = await loadLocale(initialLang);
    if (translations) {
      resources[initialLang] = { translation: translations };
    }
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: fallbackLocale,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },
  });

  return i18n;
}

/**
 * Get the current language code
 */
export function getCurrentLanguage(): string {
  return i18n.language || fallbackLocale;
}

/**
 * Change the app language and persist the preference
 */
export async function setLanguage(languageCode: string): Promise<void> {
  // Load locale bundle if not already loaded
  if (!i18n.hasResourceBundle(languageCode, "translation")) {
    const translations = await loadLocale(languageCode);
    if (translations) {
      i18n.addResourceBundle(languageCode, "translation", translations);
    }
  }
  await i18n.changeLanguage(languageCode);
  useLanguageStore.getState().setUserLanguage(languageCode);
}

// Re-export i18n instance
export { i18n };

// Type-safe translation key paths
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: TObj[TKey] extends object
    ? `${TKey}` | `${TKey}.${RecursiveKeyOf<TObj[TKey]>}`
    : `${TKey}`;
}[keyof TObj & (string | number)];

export type TxKeyPath = RecursiveKeyOf<Translations>;
