import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

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

/**
* Provides a consistent way to access window dimensions and screen size
* information across mobile and web.
*
* On web the first render uses `DEFAULT_VIEWPORT_WIDTH` / `_HEIGHT` — the
* window can't be read while the HTML shell is rendered in Node at export
* time, and reading it during the browser's first render would disagree with
* that markup. A post-mount effect swaps in the real viewport and follows
* resize from there.
*/
export const useDimensions = (): WindowDimensions => {
  const isWeb = Platform.OS === "web";

  // Native reads come from useWindowDimensions, which subscribes to rotation /
  // split-screen / resize and tears the listener down for us — no manual
  // Dimensions.addEventListener to leak. On web we ignore it and drive layout
  // from the default frame + the resize listener below.
  const native = useWindowDimensions();

  const [dimensions, setDimensions] = useState<WindowDimensions>(() =>
    calculateDimensionFlags(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT)
  );

  // Web: read the real viewport after mount and follow resize events. Keeping
  // this in an effect (not render) keeps the first render identical to the
  // exported markup it hydrates.
  useEffect(() => {
    if (!isWeb) return;

    const syncFromWindow = () => {
      setDimensions(calculateDimensionFlags(window.innerWidth, window.innerHeight));
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
