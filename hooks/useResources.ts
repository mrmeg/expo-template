import { useEffect, useState } from "react";
import * as Font from "expo-font";

interface LoadResourcesResult {
  loaded: boolean;
  error: Error | null;
}

/**
 * Loads essential app resources on startup using local font files.
 *
 * LOCAL FONTS (Current Implementation):
 * - Fonts are loaded from /assets/fonts directory at startup
 * - Fonts are bundled with the app (no network request needed)
 * - Fonts available immediately after loading
 * - Better performance and offline support
 * - Font files: Lato (~145KB total), Merriweather (~285KB total)
 *
 * ALTERNATIVE: GOOGLE FONTS CDN
 * To use @expo-google-fonts packages instead (loads from CDN at runtime):
 *
 * 1. Install packages:
 *    npm install @expo-google-fonts/lato @expo-google-fonts/merriweather
 *
 * 2. Replace this hook's implementation with:
 *    ```
 *    import {
 *      useFonts as useLatoFonts,
 *      Lato_400Regular,
 *      Lato_700Bold,
 *    } from "@expo-google-fonts/lato";
 *    import {
 *      useFonts as useMerriweatherFonts,
 *      Merriweather_400Regular,
 *      Merriweather_700Bold,
 *    } from "@expo-google-fonts/merriweather";
 *
 *    export const useResources = (): LoadResourcesResult => {
 *      const [latoLoaded, latoError] = useLatoFonts({
 *        Lato_400Regular,
 *        Lato_700Bold,
 *      });
 *
 *      const [merriweatherLoaded, merriweatherError] = useMerriweatherFonts({
 *        Merriweather_400Regular,
 *        Merriweather_700Bold,
 *      });
 *
 *      const loaded = latoLoaded && merriweatherLoaded;
 *      const error = latoError || merriweatherError;
 *
 *      return { loaded, error };
 *    };
 *    ```
 *
 * 3. Benefits of CDN approach:
 *    - Fonts cached after first load
 *    - Zero impact on initial app bundle size
 *    - Automatic updates when Google updates fonts
 *
 * Note: Font family names MUST match between Google Fonts and local fonts
 * (e.g., "Lato_400Regular" in both cases) for seamless switching.
 *
 * FONT SUBSETTING:
 * To reduce font file sizes by 50-70%, subset the fonts to include only
 * needed characters using pyftsubset (part of fonttools):
 *
 * pip install fonttools brotli
 *
 * pyftsubset Merriweather-Regular.ttf \
 *   --output-file="Merriweather-Regular-subset.ttf" \
 *   --flavor=ttf \
 *   --layout-features="kern,liga,calt" \
 *   --unicodes="U+0020-007F,U+00A0-00FF,U+2000-206F,U+20AC" \
 *   --no-hinting \
 *   --desubroutinize
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
        await Font.loadAsync({
          "Lato_400Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
          "Lato_700Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
          "Merriweather_400Regular": require("@/assets/fonts/Merriweather/Merriweather-Regular.ttf"),
          "Merriweather_700Bold": require("@/assets/fonts/Merriweather/Merriweather-Bold.ttf"),
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
