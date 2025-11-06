import {
  useFonts as useLatoFonts,
  Lato_400Regular,
  Lato_700Bold,
} from "@expo-google-fonts/lato";
import {
  useFonts as useMerriweatherFonts,
  Merriweather_400Regular,
  Merriweather_700Bold,
} from "@expo-google-fonts/merriweather";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

/**
 * Loads essential app resources on startup using Expo Google Fonts.
 *
 * GOOGLE FONTS (Current Implementation):
 * - Uses @expo-google-fonts packages for automatic font loading
 * - Fonts are downloaded from Google Fonts CDN on first launch and cached
 * - No local font files needed in /assets/fonts
 * - Simpler setup with less bundle size impact
 *
 * TO USE LOCAL FONTS INSTEAD:
 * 1. Remove @expo-google-fonts packages:
 *    npm uninstall @expo-google-fonts/lato @expo-google-fonts/merriweather
 *
 * 2. Add font files to /assets/fonts/Lato and /assets/fonts/Merriweather
 *
 * 3. Replace this hook's implementation with:
 *    ```
 *    import { useEffect, useState } from "react";
 *    import * as Font from "expo-font";
 *
 *    export const useResources = (): LoadResourcesResult => {
 *      const [loaded, setLoaded] = useState(false);
 *      const [error, setError] = useState(null);
 *
 *      useEffect(() => {
 *        async function loadResourcesAndDataAsync() {
 *          try {
 *            await Font.loadAsync({
 *              "Lato_400Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
 *              "Lato_700Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
 *              "Merriweather_400Regular": require("@/assets/fonts/Merriweather/Merriweather-Regular.ttf"),
 *              "Merriweather_700Bold": require("@/assets/fonts/Merriweather/Merriweather-Bold.ttf"),
 *            });
 *          } catch (e: any) {
 *            console.warn(e);
 *            setError(e);
 *          } finally {
 *            setLoaded(true);
 *          }
 *        }
 *        loadResourcesAndDataAsync();
 *      }, []);
 *
 *      return { loaded, error };
 *    };
 *    ```
 *
 * Note: Font family names MUST match between Google Fonts and local fonts
 * (e.g., "Lato_400Regular" in both cases) for seamless switching.
 *
 * Returns:
 *   - loaded: true when all resources are ready
 *   - error: any error encountered during loading
 */
export const useResources = (): LoadResourcesResult => {
  // Load both font families using their respective hooks
  const [latoLoaded, latoError] = useLatoFonts({
    Lato_400Regular,
    Lato_700Bold,
  });

  const [merriweatherLoaded, merriweatherError] = useMerriweatherFonts({
    Merriweather_400Regular,
    Merriweather_700Bold,
  });

  // Combine loading states
  const loaded = latoLoaded && merriweatherLoaded;
  const error = latoError || merriweatherError;

  return { loaded, error };
};
