import { useEffect } from "react";
import { Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";

/**
 * Keeps the document's `<meta name="theme-color">` in step with the active
 * theme after hydration, so Safari's status bar / toolbar (and Android
 * Chrome's status bar) re-tint when the user toggles the theme in-app.
 *
 * The server renders the first-paint meta in app/+html.tsx: one unqualified
 * meta when the request carried a theme signal, or a
 * `prefers-color-scheme`-gated pair when it didn't (same conditional-stamp
 * contract as `data-theme` — never pin a guess; see docs/ssr-hydration.md §5).
 * Those live outside the React root, so this hook owns them via the DOM: on
 * the first themed commit it removes the media-gated fallbacks and ensures a
 * single meta whose content tracks the store. The store's first resolved
 * scheme agrees with whatever the server rendered, so taking ownership never
 * changes the color mid-paint — later writes only happen on real toggles.
 */
export function useSafariThemeColorSync(): void {
  const { theme } = useTheme();
  const background = theme.colors.background;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    // The media-gated pair only exists on no-signal responses; once the store
    // has resolved a scheme there is exactly one truth, so the fallbacks go.
    document
      .querySelectorAll('meta[name="theme-color"][media]')
      .forEach((meta) => meta.remove());

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = background;
  }, [background]);
}
