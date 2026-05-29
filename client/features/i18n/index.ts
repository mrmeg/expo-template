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

import en, { type Translations } from "./translations/en";
import { useLanguageStore } from "./stores/languageStore";

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
    return (await import("./translations/es")).default;
  default:
    return null;
  }
}

/**
 * Synchronous, idempotent English bootstrap — safe to call during render,
 * including on the server.
 *
 * Web runs in Expo Router `server` output mode, so screens are server-rendered
 * before hydration. `initI18n()` is async and only runs in a `useEffect`, which
 * never fires on the server — so without this, i18next is uninitialized during
 * SSR and any `t("a.b")` emits the raw key server-side but the translation
 * client-side → a hydration mismatch (see docs/ssr-hydration.md §3).
 *
 * Inline resources + `initAsync: false` make `init()` resolve synchronously, so
 * `t()` works on the very first render. `initI18n()` still runs post-hydration
 * to upgrade to a detected/persisted non-English locale.
 *
 * Wrapped in try/catch so a test mock of `react-i18next` (which replaces
 * `initReactI18next`) can never crash module import. The i18next v26 flag is
 * `initAsync` (it was `initImmediate` in older majors).
 */
export function ensureI18nInitialized(): void {
  if (i18n.isInitialized) return;
  try {
    void i18n
      .use(initReactI18next)
      .init({
        resources: { en: { translation: en } },
        lng: fallbackLocale,
        fallbackLng: fallbackLocale,
        initAsync: false,
        interpolation: {
          escapeValue: false, // React already escapes
        },
        react: {
          useSuspense: false, // Disable suspense for SSR compatibility
        },
      })
      .catch(() => {
        // Terminal state is owned by initI18n(); swallow here so render
        // never throws on a transient init rejection.
      });
  } catch {
    // Never crash module import (e.g. a test mock without a real
    // initReactI18next module).
  }
}

// Best-effort at module load so a bare import initializes English. The render
// body of app/_layout.tsx also calls this — Metro's inlineRequires can defer a
// pure module-load side effect so it never runs on the server, and the render
// call guarantees it runs during SSR before any screen.
ensureI18nInitialized();

/**
 * Initialize i18n - call this before rendering the app.
 * Restores a saved language preference, or falls back to device locale.
 */
export async function initI18n(): Promise<typeof i18n> {
  // English is already initialized synchronously by ensureI18nInitialized()
  // at module load (and again in the root layout's render body for SSR). This
  // call's job is the post-hydration upgrade: load and switch to a
  // detected/persisted non-English locale, if there is one.
  ensureI18nInitialized();

  // Check for a persisted language preference
  const savedLang = await useLanguageStore.getState().loadLanguage();
  const detectedLang = locale?.languageTag.split("-")[0] ?? fallbackLocale;
  const initialLang = savedLang && supportedTags.includes(savedLang) ? savedLang : detectedLang;

  if (initialLang !== fallbackLocale) {
    // Lazy-load the non-default locale bundle, then switch.
    if (!i18n.hasResourceBundle(initialLang, "translation")) {
      const translations = await loadLocale(initialLang);
      if (translations) {
        i18n.addResourceBundle(initialLang, "translation", translations);
      }
    }
    if (i18n.hasResourceBundle(initialLang, "translation")) {
      await i18n.changeLanguage(initialLang);
    }
  }

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
