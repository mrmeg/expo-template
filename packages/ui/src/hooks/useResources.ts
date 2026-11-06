import { useEffect, useState } from "react";
import { Platform } from "react-native";

import type { SansPreset, SerifPreset } from "../constants/fonts";
import { geistFontMap } from "../lib/geistFonts";
import { loadNativeFonts } from "../lib/loadNativeFonts";
import { useThemeStore } from "../state/themeStore";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

export interface UseResourcesOptions {
  /**
   * Which sans to switch the `sansSerif` variant to. Geist (the package
   * default, bundled) always loads: the native files ship with the package and
   * the web stylesheet is skipped when `app/+html.tsx` already self-hosts it.
   * `"inter"` additionally loads Inter (the classic look's face): the
   * Google Fonts stylesheet on web and, on native, the files passed as
   * `sansFonts`, then sets the theme store's `sansPreset` so sans text
   * resolves to Inter. An app `setFonts` sansSerif override skips every sans
   * face and the preset (the override wins anyway).
   */
  sans?: SansPreset;
  /**
   * Native font map for the Inter preset, from the app's own dependency:
   * `@expo-google-fonts/inter/400Regular` … `700Bold` (the names
   * `interFamilies.native` expects). The package does not depend on the Inter
   * font package, so an app that never opts in ships none of it; on web this
   * is ignored (the stylesheet serves the faces).
   */
  sansFonts?: Record<string, number | string> | null;
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

// Loading at startup stays: all nine faces the template registers (Geist plus
// the serif preset) took 19 to 30 ms in release builds on an iPhone 13 Pro and
// a Pixel 6a, cold start. Embedding them would need a native rebuild per app
// and per-platform family names, which isn't worth that wait.
function loadNativeGeistFonts(): Promise<void> {
  if (Platform.OS === "web" || !geistFontMap) {
    return Promise.resolve();
  }
  return loadNativeFonts(geistFontMap);
}

const GEIST_STYLESHEET_ID = "mrmeg-expo-ui-geist";
// The four upright weights the native files mirror; Geist ships no italic, so
// `italic` is synthesized everywhere.
const GEIST_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap";

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

let warnedMissingSansFonts = false;

/**
 * Load a sans preset and switch the `sansSerif` variant to it.
 *
 * Web: the preset switches at once and the Google Fonts stylesheet loads
 * after it (the stack falls back to the system face until the faces arrive,
 * and a self-hosted `<style id="mrmeg-expo-ui-geist|inter">` in the document
 * counts as already loaded). Native: the files register first and the preset
 * switches after, since a native font name that is not loaded is an error,
 * not a fallback. `"geist"` registers the bundled files; `"inter"` registers
 * `nativeFonts` (the app's `@expo-google-fonts/inter` per-weight map) and,
 * when it is missing, warns once and keeps the current sans.
 *
 * `useResources` runs this at startup; call it directly to switch at runtime,
 * e.g. before `applyLook(classicLook)`. A `setFonts` sansSerif override wins
 * over any preset, so nothing is loaded or switched while one is set.
 */
export async function loadSansPreset(
  preset: SansPreset,
  nativeFonts?: Record<string, number | string> | null,
): Promise<void> {
  const store = useThemeStore.getState();
  if (store.fontOverrides.families?.sansSerif) return;

  if (Platform.OS === "web") {
    store.setSansPreset(preset);
    if (preset === "inter") {
      await ensureWebFontStylesheet(INTER_STYLESHEET_ID, INTER_STYLESHEET_URL, "Inter");
    } else {
      await ensureWebFontStylesheet(GEIST_STYLESHEET_ID, GEIST_STYLESHEET_URL, "Geist");
    }
    return;
  }

  if (preset === "inter") {
    if (!nativeFonts) {
      if (!warnedMissingSansFonts) {
        warnedMissingSansFonts = true;
        console.warn(
          "The \"inter\" sans preset needs a font map on native: pass the @expo-google-fonts/inter " +
            "faces (400Regular, 500Medium, 600SemiBold, 700Bold) as `sansFonts` / the second " +
            "argument of loadSansPreset. Keeping Geist.",
        );
      }
      return;
    }
    await loadNativeFonts(nativeFonts);
  } else {
    await loadNativeGeistFonts();
  }
  useThemeStore.getState().setSansPreset(preset);
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

  await loadNativeFonts(options.serifFonts);
  useThemeStore.getState().setSerifPreset("newsreader");
}

export const useResources = (options: UseResourcesOptions = {}): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { serif, serifFonts, sans, sansFonts } = options;

  useEffect(
    () => startResourceLoad({ serif, serifFonts, sans, sansFonts }, setError, () => setLoaded(true)),
    [serif, serifFonts, sans, sansFonts],
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
        sansSerifOverridden ? Promise.resolve() : loadNativeGeistFonts(),
        sansSerifOverridden
          ? Promise.resolve()
          : ensureWebFontStylesheet(GEIST_STYLESHEET_ID, GEIST_STYLESHEET_URL, "Geist"),
        options.sans === "inter" ? loadSansPreset("inter", options.sansFonts) : Promise.resolve(),
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
