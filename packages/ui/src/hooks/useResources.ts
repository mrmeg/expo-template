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

// Eager, module-scope load that primes the Feather font on the *client* before
// first render: on web it synchronously injects the @font-face rule, which is
// what makes the client's `Font.isLoaded("feather")` check read true during
// hydration; on native it just starts the fetch ahead of the effect below
// (which then no-ops for the already-loaded font).
//
// Deliberately guarded off server-web. expo-font's SSR store is per-request
// AsyncLocalStorage, and Metro's inlineRequires defers this module's evaluation
// until it is first required during a render — so on the server this line only
// ever populated the store of whichever request happened to warm the module
// cache. Requests 2+ then shipped HTML with no @font-face and empty icons while
// the client rendered glyphs (React #418). Server registration happens
// per-request in ensureIconFontRegistered() instead.
if (typeof window !== "undefined") {
  void Font.loadAsync(Feather.font);
}

/**
 * Registers the Feather icon font in expo-font's per-request SSR store.
 *
 * Must be called from a **render body** on server-web (see `useResources`
 * below): expo-font enters an `AsyncLocalStorage` store per request, so a
 * module-scope registration lands in at most one request's store. Registering
 * during render means every request emits the `@font-face` rule into
 * `<style id="expo-generated-fonts">` and server-rendered `<Icon>`s agree with
 * the client's first render.
 *
 * No-op on native and on client web (both already covered: native by the
 * effect below, client web by the module-scope call above).
 */
export function ensureIconFontRegistered(): void {
  if (Platform.OS !== "web" || typeof window !== "undefined") return;
  if (Font.isLoaded("feather")) return; // per-request store; cheap
  // Synchronous on server-web (expo-font routes to registerStaticFont). No
  // `void`/try-catch: a throw here means we're outside a request scope, which
  // must be loud.
  Font.loadAsync(Feather.font);
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
  // Render-body (not effect) so server-web registers the icon font in *this*
  // request's expo-font store — effects never run on the server and a
  // module-scope call only reaches one request. See ensureIconFontRegistered.
  ensureIconFontRegistered();

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
