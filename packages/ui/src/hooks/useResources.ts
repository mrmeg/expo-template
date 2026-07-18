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

// Eager, module-scope load so expo-font registers Feather in its SSR
// serverContext. When the server renders the HTML document, expo-font emits
// an @font-face <style> into the head — without this kickoff, server-rendered
// <Icon> components paint as empty glyphs until hydration runs the effect
// below, producing a visible icon-pop flash on icon-heavy SSR screens
// (e.g. OnboardingFlow). On the client this also primes the font ahead of
// the effect; the effect's loadAsync becomes a no-op for the already-loaded
// font.
void Font.loadAsync(Feather.font);

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
 */
export const useResources = (): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function loadResourcesAndDataAsync() {
      try {
        const fontPromise = Promise.all([
          Font.loadAsync(Feather.font),
          loadNativeInterFonts(),
          ensureWebFontStylesheet(),
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
