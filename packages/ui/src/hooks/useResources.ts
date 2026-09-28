import { useEffect, useState } from "react";
import * as Font from "expo-font";
import { Platform } from "react-native";

import type { SerifPreset } from "../constants/fonts";
import { interFontMap } from "../lib/interFonts";
import { useThemeStore } from "../state/themeStore";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

export interface UseResourcesOptions {
  /**
   * Which serif to load and switch the `serif` variant to. `"georgia"`
   * (default) loads nothing: the system face. `"newsreader"` injects the
   * Google Fonts Newsreader stylesheet on web and, on native, registers the
   * files passed as `serifFonts`, then sets the theme store's `serifPreset`
   * so serif text resolves to Newsreader. An app `setFonts` serif override
   * skips the preset entirely (the override wins anyway).
   */
  serif?: SerifPreset;
  /**
   * Native font map for the serif preset, from the app's own dependency:
   * `@expo-google-fonts/newsreader/400Regular` … `700Bold` and
   * `400Regular_Italic` (the names `newsreaderFamilies.native` expects). The
   * package does not depend on the font package, so an app that never opts in
   * ships none of it; on web this is ignored (the stylesheet serves the faces).
   */
  serifFonts?: Record<string, number | string> | null;
}

function loadNativeInterFonts(): Promise<void> {
  if (Platform.OS === "web" || !interFontMap) {
    return Promise.resolve();
  }
  return Font.loadAsync(interFontMap);
}

const INTER_STYLESHEET_ID = "mrmeg-expo-ui-inter";
// Four upright weights plus the 400 italic, so `italic` renders a real italic
// on web at body weight (other weights synthesize).
const INTER_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";

const NEWSREADER_STYLESHEET_ID = "mrmeg-expo-ui-newsreader";
const NEWSREADER_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";

function ensureWebFontStylesheet(id: string, href: string, label: string): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (document.getElementById(id)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`${label} stylesheet failed to load`));
    document.head.appendChild(link);
  });
}

let warnedMissingSerifFonts = false;

/**
 * The Newsreader preset: the stylesheet on web (the preset switches at once;
 * the stack falls back to Georgia until the faces arrive), the app-supplied
 * files on native (the preset switches after they register, since a native
 * font name that is not loaded is an error, not a fallback).
 */
async function loadSerifPreset(options: UseResourcesOptions): Promise<void> {
  if (options.serif !== "newsreader") return;
  if (useThemeStore.getState().fontOverrides.families?.serif) return;

  if (Platform.OS === "web") {
    useThemeStore.getState().setSerifPreset("newsreader");
    await ensureWebFontStylesheet(NEWSREADER_STYLESHEET_ID, NEWSREADER_STYLESHEET_URL, "Newsreader");
    return;
  }

  if (!options.serifFonts) {
    if (!warnedMissingSerifFonts) {
      warnedMissingSerifFonts = true;
      console.warn(
        "useResources({ serif: \"newsreader\" }) needs `serifFonts` on native: pass the map of " +
          "@expo-google-fonts/newsreader faces (400Regular, 500Medium, 600SemiBold, 700Bold, " +
          "400Regular_Italic). Keeping Georgia.",
      );
    }
    return;
  }

  await Font.loadAsync(options.serifFonts);
  useThemeStore.getState().setSerifPreset("newsreader");
}

export const useResources = (options: UseResourcesOptions = {}): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { serif, serifFonts } = options;

  useEffect(
    () => startResourceLoad({ serif, serifFonts }, setError, () => setLoaded(true)),
    [serif, serifFonts],
  );

  return { loaded, error };
};

function startResourceLoad(
  options: UseResourcesOptions,
  onError: (error: Error) => void,
  onLoaded: () => void,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const sansSerifOverridden =
    !!useThemeStore.getState().fontOverrides.families?.sansSerif;

  async function loadResourcesAndDataAsync() {
    try {
      const fontPromise = Promise.all([
        sansSerifOverridden ? Promise.resolve() : loadNativeInterFonts(),
        sansSerifOverridden
          ? Promise.resolve()
          : ensureWebFontStylesheet(INTER_STYLESHEET_ID, INTER_STYLESHEET_URL, "Inter"),
        loadSerifPreset(options),
      ]);

      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Font loading timed out after 5s")),
          5000
        );
      });

      await Promise.race([fontPromise, timeoutPromise]);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.warn("Font loading issue (proceeding with fallback):", error.message);
      onError(error);
    } finally {
      clearTimeout(timeoutId);
      onLoaded();
    }
  }
  loadResourcesAndDataAsync();

  return () => clearTimeout(timeoutId);
}
