import { Platform } from "react-native";
import { loadSansPreset } from "@mrmeg/expo-ui/hooks";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import { interFontMap } from "@/client/lib/fonts/interFonts";
import type { DemoLook } from "../looks";

/** Give up waiting on a stylesheet after this long and apply the look anyway. */
const STYLESHEET_TIMEOUT_MS = 4000;

/** Inject a stylesheet `<link>` once (web), resolving when it loads, fails, or times out. */
function ensureStylesheet(id: string, href: string): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") return Promise.resolve();
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    // A failed font request is not worth blocking the look on: the stack falls back.
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
    setTimeout(resolve, STYLESHEET_TIMEOUT_MS);
  });
}

/**
 * Get a look's faces ready before `applyLook`: the Inter files on native and
 * the Inter stylesheet on web for `sans: "inter"`, and Strand's Google Fonts
 * stylesheet on web. Native Strand adds no files (it keeps the default sans and
 * the platform mono).
 */
export async function loadLookFonts(demo: DemoLook): Promise<void> {
  if (demo.fonts) {
    await ensureStylesheet(demo.fonts.webStylesheet.id, demo.fonts.webStylesheet.href);
  }
  if (demo.look.sans === "inter") {
    // `loadSansPreset` does nothing while a sansSerif override is set (Strand's
    // web override), so clear the overrides the previous look left first.
    useThemeStore.getState().setFonts({});
    await loadSansPreset("inter", interFontMap);
  }
}
