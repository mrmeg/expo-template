/**
 * The safe-area metrics `RootLayout` hands `SafeAreaProvider`, and the width it
 * feeds `SsrViewportContext`.
 *
 * Why this exists: a bare `<SafeAreaProvider>` falls back to
 * `Dimensions.get('window')`, and under react-native-web's server build that is
 * `{width: 0, height: 0}` (`update()` early-returns without a DOM). Every
 * layout downstream of the frame is then computed at width 0, so the SSR HTML
 * ships negative `max-width`s from expo-router's `Header`
 * (`maxWidth: layout.width - 68`), collapsed centered containers, and content
 * hugging the left edge — then jumps at hydration with a React #418 mismatch.
 *
 * The fix has the same shape as the onboarding cookie (docs/ssr-hydration.md
 * §6) and `useDimensions` (§4): resolve the value from a signal *both* sides
 * have, so the server HTML and the browser's first render agree.
 *
 *   - server: Expo Server's ambient request scope (`Cookie` / `User-Agent`)
 *   - browser: `document.cookie` / `navigator.userAgent`
 *
 * Both go through `resolveSsrViewportWidth`, so they derive the same number
 * from the same bytes. After mount, `useDimensions`'s effect reads the real
 * `window.innerWidth` and refreshes the cookie for next time — so a wrong UA
 * guess costs one frame, never a wrong layout.
 *
 * Native returns `undefined`, which keeps `SafeAreaProvider` on its real
 * measurement path: there is no SSR to agree with, and forcing zero insets
 * would break notch / home-indicator padding.
 */

import { Platform } from "react-native";
import { SSR_VIEWPORT_DEFAULT_WIDTH } from "@mrmeg/expo-ui/state";

import {
  detectSsrViewportFromRequestScope,
  detectSsrViewportHeight,
  resolveSsrViewportWidth,
  type SsrViewport,
} from "@/server/lib/ssrViewport";

/** The `initialMetrics` shape `react-native-safe-area-context` reads. */
export type SsrInitialMetrics = {
  frame: { x: number; y: number; width: number; height: number };
  insets: { top: number; right: number; bottom: number; left: number };
};

/**
 * Resolve the viewport for this render.
 *
 * In the browser we read `document.cookie` / `navigator.userAgent` rather than
 * `window.innerWidth`, even though the real width is right there. Using the
 * real width would make the client's first render disagree with the server's —
 * which is the exact mismatch this module exists to remove. `useDimensions`
 * picks up the true width in a post-mount effect instead.
 */
function resolveSsrViewport(): SsrViewport {
  if (typeof document !== "undefined") {
    const width = resolveSsrViewportWidth(
      document.cookie,
      typeof navigator !== "undefined" ? navigator.userAgent : null
    );
    return { width, height: detectSsrViewportHeight(width) };
  }
  return detectSsrViewportFromRequestScope();
}

/**
 * The viewport width for this render, for `SsrViewportContext`.
 *
 * Keeps `useDimensions` on the same width as the safe-area frame — otherwise
 * the frame would say 390 while every `isSmallScreen` branch said 1280.
 *
 * Native returns the package default. `useDimensions` ignores the context
 * entirely there (it reads `useWindowDimensions`), so the value is inert — but
 * it stays a sane number rather than a placeholder zero.
 */
export function resolveSsrViewportWidthForRender(): number {
  if (Platform.OS !== "web") return SSR_VIEWPORT_DEFAULT_WIDTH;
  return resolveSsrViewport().width;
}

/**
 * The `initialMetrics` for `SafeAreaProvider`, or `undefined` on native.
 *
 * Always a freshly built object: never hoist this into a module constant. The
 * server-side module scope is shared across concurrent requests, so a cached
 * frame would let a phone request's width leak into a desktop request's layout
 * — the same per-request leak the theme store and the RNW stylesheet have to
 * avoid (docs/ssr-hydration.md §7).
 */
export function resolveSsrInitialMetrics(): SsrInitialMetrics | undefined {
  if (Platform.OS !== "web") return undefined;

  const { width, height } = resolveSsrViewport();
  return {
    frame: { x: 0, y: 0, width, height },
    // Zero insets are required, not lazy: the browser cannot know real insets
    // until the safe-area probe element mounts, so any other value here would
    // be a guaranteed first-render mismatch.
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}
