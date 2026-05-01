import { useEffect, useState } from "react";
import * as Font from "expo-font";
import Feather from "@expo/vector-icons/Feather";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

/**
 * Loads essential app resources on startup using local font files.
 *
 * Fonts are loaded from /assets/fonts directory at startup.
 * Bundled with the app (no network request needed).
 *
 * Returns:
 *   - loaded: true when all resources are ready
 *   - error: any error encountered during loading
 */
export const useResources = (): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        const fontPromise = Font.loadAsync({
          ...Feather.font,
          "Lato_400Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
          "Lato_700Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
        });

        // Timeout after 5 seconds — proceed with system fallback fonts
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Font loading timed out after 5s")), 5000)
        );

        await Promise.race([fontPromise, timeoutPromise]);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.warn("Font loading issue (proceeding with fallback):", error.message);
        setError(error);
      } finally {
        setLoaded(true);
      }
    }
    loadResourcesAndDataAsync();
  }, []);

  return { loaded, error };
};
