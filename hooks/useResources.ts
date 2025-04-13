import { useEffect, useState } from "react";
import * as Font from "expo-font";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

/**
 * Loads essential app resources on startup (e.g. fonts, images, initial data).
 * Currently loads custom fonts; extend to include asset preloading or async storage setup.
 *
 * Returns:
 *   - loaded: true when all resources are ready
 *   - error: any error encountered during loading
 */

export const useResources = (): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        await Font.loadAsync({
          "Merriweather-Regular": require("@/assets/fonts/Merriweather/Merriweather-Regular.ttf"),
          "Merriweather-Bold": require("@/assets/fonts/Merriweather/Merriweather-Bold.ttf"),
          "Lato-Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
          "Lato-Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
        });
      } catch (e: any) {
        console.warn(e);
        setError(e);
      } finally {
        setLoaded(true);
      }
    }

    loadResourcesAndDataAsync();
  }, []);

  return { loaded, error };
};
