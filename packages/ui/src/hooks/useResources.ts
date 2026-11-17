import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { getAlloStylesheetUrl, sansStylesheetIds } from "../constants/alloWebFonts";
import { defaultSansPreset, type SansPreset, type SerifPreset } from "../constants/fonts";
import { alloFonts } from "../lib/alloFonts";
import { loadNativeFonts } from "../lib/loadNativeFonts";
import { useThemeStore } from "../state/themeStore";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

export interface UseResourcesOptions {
  /**
   * Which sans to switch the `sansSerif` variant to. `"allo"` (the package
   * default: Allo at its sharp roundness, bundled) always loads: the native
   * files ship with the package and the web stylesheet is skipped when
   * `app/+html.tsx` already self-hosts it. Any other preset additionally
   * loads its own faces: its stylesheet on web and, on native, the files
   * passed as `sansFonts`, then sets the theme store's `sansPreset` so sans
   * text resolves to it. An app `setFonts` sansSerif override skips every
   * sans face and the preset (the override wins anyway).
   */
  sans?: SansPreset;
  /**
   * Native font map for a sans preset other than the default:
   * - `"allo-friendly"` / `"allo-round"`: `alloFriendlyFonts` from
   *   `@mrmeg/expo-ui/fonts/allo-friendly`, `alloRoundFonts` from
   *   `@mrmeg/expo-ui/fonts/allo-round`;
   * - `"geist"` / `"inter"`: the app's own `@expo-google-fonts/geist` or
   *   `@expo-google-fonts/inter` faces, `400Regular` … `700Bold` (the names
   *   `sansPresetFamilies[preset].native` expects).
   *
   * Each map is a separate import, so an app that never opts in ships none of
   * the files; on web this is ignored (the stylesheet serves the faces).
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

// Loading at startup stays: all nine faces the template registers (the default
// sans plus the serif preset) took 19 to 30 ms in release builds on an iPhone
// 13 Pro and a Pixel 6a, cold start (measured with the previous default,
// Geist; the Allo files are the same size). Embedding them would need a native
// rebuild per app and per-platform family names, which isn't worth that wait.
function loadNativeDefaultSansFonts(): Promise<void> {
  if (Platform.OS === "web") {
    return Promise.resolve();
  }
  return loadNativeFonts(alloFonts);
}

// The stylesheet each sans preset falls back to when the document does not
// already carry its faces (an element with `sansStylesheetIds[preset]`). The
// Allo cuts are the package's own published files; they are upright only, as
// Geist is, so `italic` is synthesized. Inter adds a 400 italic, so `italic`
// renders a real italic on web at body weight (other weights synthesize).
const SANS_STYLESHEETS: Record<SansPreset, { href: string; label: string }> = {
  allo: { href: getAlloStylesheetUrl("allo"), label: "Allo" },
  "allo-friendly": { href: getAlloStylesheetUrl("allo-friendly"), label: "Allo Friendly" },
  "allo-round": { href: getAlloStylesheetUrl("allo-round"), label: "Allo Round" },
  geist: {
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
    label: "Geist",
  },
  inter: {
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
    label: "Inter",
  },
};

function ensureSansStylesheet(preset: SansPreset): Promise<void> {
  const { href, label } = SANS_STYLESHEETS[preset];
  return ensureWebFontStylesheet(sansStylesheetIds[preset], href, label);
}

// What a preset's native font map holds, for the warning when it is missing.
const SANS_FONT_SOURCES: Record<Exclude<SansPreset, "allo">, string> = {
  "allo-friendly": "`alloFriendlyFonts` from @mrmeg/expo-ui/fonts/allo-friendly",
  "allo-round": "`alloRoundFonts` from @mrmeg/expo-ui/fonts/allo-round",
  geist: "the @expo-google-fonts/geist faces (400Regular, 500Medium, 600SemiBold, 700Bold)",
  inter: "the @expo-google-fonts/inter faces (400Regular, 500Medium, 600SemiBold, 700Bold)",
};

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

const warnedMissingSansFonts = new Set<SansPreset>();

/**
 * Load a sans preset and switch the `sansSerif` variant to it.
 *
 * Web: the preset switches at once and its stylesheet loads after it (the
 * stack falls back to the system face until the faces arrive, and a
 * self-hosted `<style id={sansStylesheetIds[preset]}>` in the document counts
 * as already loaded). Native: the files register first and the preset switches
 * after, since a native font name that is not loaded is an error, not a
 * fallback. `"allo"` registers the bundled files; every other preset registers
 * `nativeFonts` (see `UseResourcesOptions.sansFonts`) and, when it is missing,
 * warns once and keeps the current sans.
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
    await ensureSansStylesheet(preset);
    return;
  }

  if (preset === defaultSansPreset) {
    await loadNativeDefaultSansFonts();
  } else {
    if (!nativeFonts) {
      if (!warnedMissingSansFonts.has(preset)) {
        warnedMissingSansFonts.add(preset);
        console.warn(
          `The "${preset}" sans preset needs a font map on native: pass ${SANS_FONT_SOURCES[preset]} ` +
            "as `sansFonts` / the second argument of loadSansPreset. Keeping the current sans.",
        );
      }
      return;
    }
    await loadNativeFonts(nativeFonts);
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
        sansSerifOverridden ? Promise.resolve() : loadNativeDefaultSansFonts(),
        sansSerifOverridden ? Promise.resolve() : ensureSansStylesheet(defaultSansPreset),
        options.sans && options.sans !== defaultSansPreset
          ? loadSansPreset(options.sans, options.sansFonts)
          : Promise.resolve(),
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
