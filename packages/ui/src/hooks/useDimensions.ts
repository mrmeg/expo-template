import { use, useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { SsrViewportContext } from "../state/SsrViewportContext";

/**
 * Viewport the first web render is computed from, before the real window can
 * be read. Desktop is chosen because:
 *   1. A desktop visitor sees no reflow — their real viewport lands in the
 *      same breakpoint.
 *   2. A mobile visitor gets one frame of desktop-styled content before the
 *      post-mount effect snaps to real dimensions — better than the inverse
 *      (every desktop visitor seeing mobile-tiny, then snapping).
 *   3. It matches the frame the app hands `SafeAreaProvider`, and it is the
 *      value the HTML shell `expo export` renders in Node is built from, so
 *      the browser's first render agrees with the markup it hydrates.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1280;
export const DEFAULT_VIEWPORT_HEIGHT = 800;

export const SCREEN_SIZES = {
  SMALL: 768,
  MEDIUM: 1000,
  LARGE: 1200,
} as const;

type WindowDimensions = {
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
}

/**
* Helper function to calculate dimension-based flags
*/
const calculateDimensionFlags = (width: number, height: number): WindowDimensions => {
  const orientation = width > height ? "landscape" : "portrait";
  return {
    width,
    height,
    orientation,
    isSmallScreen: width <= SCREEN_SIZES.SMALL,
    isMediumScreen: width > SCREEN_SIZES.SMALL && width <= SCREEN_SIZES.MEDIUM,
    isLargeScreen: width > SCREEN_SIZES.MEDIUM,
  };
};

// Persist the real viewport width as a cookie on first mount so subsequent
// SSR requests can render at the user's actual layout (no reflow on repeat
// visits). The server reads this cookie via resolveSsrViewportWidth in
// server/lib/ssrViewport.ts.
const SSR_VIEWPORT_COOKIE = "mrmeg-vw";
const SSR_VIEWPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeViewportCookie(width: number): void {
  if (typeof document === "undefined") return;
  // Round to nearest 10 so resize-driven writes don't bust HTTP caching on
  // every pixel of horizontal movement.
  const rounded = Math.round(width / 10) * 10;
  document.cookie = `${SSR_VIEWPORT_COOKIE}=${rounded}; path=/; max-age=${SSR_VIEWPORT_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
* Provides a consistent way to access window dimensions and screen size
* information across mobile and web.
*
* On web the first render can't read the window: server-side there is no DOM,
* and reading it during the browser's first render would disagree with the
* markup it hydrates. The width comes from `SsrViewportContext` when the host
* provides a per-request value (server render + first client render must
* provide the same one), falling back to `DEFAULT_VIEWPORT_WIDTH` / `_HEIGHT`.
* A post-mount effect swaps in the real viewport and follows resize from
* there.
*/
export const useDimensions = (): WindowDimensions => {
  const isWeb = Platform.OS === "web";
  const ssrWidth = use(SsrViewportContext);

  // Native reads come from useWindowDimensions, which subscribes to rotation /
  // split-screen / resize and tears the listener down for us — no manual
  // Dimensions.addEventListener to leak. On web we ignore it and drive layout
  // from the seeded frame + the resize listener below.
  const native = useWindowDimensions();

  const [dimensions, setDimensions] = useState<WindowDimensions>(() =>
    calculateDimensionFlags(ssrWidth ?? DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT)
  );

  // Web: read the real viewport after mount and follow resize events. Keeping
  // this in an effect (not render) keeps the first render identical to the
  // exported markup it hydrates.
  useEffect(() => {
    if (!isWeb) return;

    const syncFromWindow = () => {
      setDimensions(calculateDimensionFlags(window.innerWidth, window.innerHeight));
      writeViewportCookie(window.innerWidth);
    };

    syncFromWindow();
    window.addEventListener("resize", syncFromWindow);
    return () => {
      window.removeEventListener("resize", syncFromWindow);
    };
  }, [isWeb]);

  // Native: useWindowDimensions already reacts to changes; mirror it into our
  // enriched flags. (On web `native` is unused — the effect above wins.)
  if (!isWeb) {
    return calculateDimensionFlags(native.width, native.height);
  }

  return dimensions;
};
