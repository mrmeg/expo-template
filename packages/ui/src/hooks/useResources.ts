import { useEffect, useState } from "react";
import * as Font from "expo-font";
import Feather from "@expo/vector-icons/Feather";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Platform } from "react-native";

import { useThemeStore } from "../state/themeStore";

// Eager, module-scope load that primes the Feather font before first render:
// on web it synchronously injects the @font-face rule, so icons have their
// glyphs on the first paint; on native it just starts the fetch ahead of the
// effect below (which then no-ops for the already-loaded font).
//
// Guarded on `window` because web bundles are also evaluated in Node when
// `expo export` renders the HTML shell, where there is no document to inject
// into.
if (typeof window !== "undefined") {
  void Font.loadAsync(Feather.font);
}

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

// The four static Inter weights StyledText's native family keys point at
// (see constants/fonts.ts). Native-only: web never renders these family names
// ("Inter_400Regular" etc.) — fontFamilies.sansSerif resolves every weight to
// the single "Inter" CSS family on web (loaded via ensureWebFontStylesheet
// below), so fetching these .ttf assets there would just be ~1.3MB of dead
// weight with nothing pointing at them.
const interFontMap = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

function loadNativeInterFonts(): Promise<void> {
  if (Platform.OS === "web") {
    return Promise.resolve();
  }
  return Font.loadAsync(interFontMap);
}

const INTER_STYLESHEET_ID = "mrmeg-expo-ui-inter";
const INTER_STYLESHEET_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

function ensureWebFontStylesheet(): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (document.getElementById(INTER_STYLESHEET_ID)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = INTER_STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = INTER_STYLESHEET_URL;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Inter stylesheet failed to load"));
    document.head.appendChild(link);
  });
}

/**
 * Loads essential app resources on startup.
 *
 * Native platforms load four static Inter weights (via
 * @expo-google-fonts/inter) so StyledText's weight range resolves to real
 * font files. Web loads Inter from Google Fonts as a single CSS family;
 * weight differentiation there comes from a numeric fontWeight instead.
 *
 * A host app that overrides the sans-serif families via `setFonts` owns
 * loading its own faces (typically through `expo-font`), so the Inter fetch
 * is skipped entirely — nothing would reference those files. For the skip to
 * apply, call `setFonts` before this hook mounts (module scope or ahead of
 * rendering the root); a later call still re-skins text, it just doesn't
 * un-download Inter. The Feather icon font always loads.
 */
export const useResources = (): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Read once at mount, not subscribed: font loading is a one-shot startup
    // effect and cannot be undone by a later override.
    const sansSerifOverridden =
      !!useThemeStore.getState().fontOverrides.families?.sansSerif;

    async function loadResourcesAndDataAsync() {
      try {
        const fontPromise = Promise.all([
          Font.loadAsync(Feather.font),
          sansSerifOverridden ? Promise.resolve() : loadNativeInterFonts(),
          sansSerifOverridden ? Promise.resolve() : ensureWebFontStylesheet(),
        ]);

        // Timeout after 5 seconds — proceed with system fallback fonts
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
        setError(error);
      } finally {
        clearTimeout(timeoutId);
        setLoaded(true);
      }
    }
    loadResourcesAndDataAsync();

    return () => clearTimeout(timeoutId);
  }, []);

  return { loaded, error };
};
