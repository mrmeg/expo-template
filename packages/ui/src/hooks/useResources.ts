import { useEffect, useState } from "react";
import * as Font from "expo-font";
import Feather from "@expo/vector-icons/Feather";
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

const LATO_STYLESHEET_ID = "mrmeg-expo-ui-lato";
const LATO_STYLESHEET_URL = "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap";

function ensureWebFontStylesheet(): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (document.getElementById(LATO_STYLESHEET_ID)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = LATO_STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = LATO_STYLESHEET_URL;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Lato stylesheet failed to load"));
    document.head.appendChild(link);
  });
}

/**
 * Loads essential app resources on startup.
 *
 * The UI package does not bundle font files. Web loads Lato from Google Fonts;
 * native platforms use their system sans-serif fallback.
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
