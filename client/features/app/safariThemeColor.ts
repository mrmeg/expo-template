import { useEffect } from "react";
import { Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { resolveRawColor } from "@mrmeg/expo-ui/constants";

/**
 * Owns the document's `<meta name="theme-color">` — Safari's status bar /
 * toolbar tint and Android Chrome's status bar — from the first themed commit
 * onward, so it re-tints when the user toggles the theme in-app.
 *
 * The meta lives outside the React root, so the hook writes it through the
 * DOM: create it once, then keep its content on the store's active background.
 */
export function useSafariThemeColorSync(): void {
  const { theme, scheme } = useTheme();
  // The meta content must be a literal color — on web `theme.colors.*` are
  // CSS var() references, which this sink cannot take.
  const background = resolveRawColor(theme.colors.background, scheme);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = background;
  }, [background]);
}
