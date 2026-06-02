import { use, useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import {
  SsrViewportContext,
  SSR_VIEWPORT_DEFAULT_HEIGHT,
} from "../state/SsrViewportContext";

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
// SSR requests can render with the user's actual layout (no flash on repeat
// visits). The server reads this cookie via your route loader using
// `detectSsrViewportWidth(request)` from server/lib/ssrViewport.ts.
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
* On web SSR, the initial width comes from `SsrViewportContext`, which a
* route's loader can populate from a `mrmeg-vw` cookie (precise, from
* previous visit) or User-Agent heuristics. Both server and the initial
* client render read the same context value so hydration matches; after
* mount, real dimensions take over and the cookie is updated for next time.
*
* Routes that don't provide the context get the package default
* (`SSR_VIEWPORT_DEFAULT_WIDTH` = 1280) — desktop-correct, mobile gets one
* frame of desktop layout before snapping.
*/
export const useDimensions = (): WindowDimensions => {
  const isWeb = Platform.OS === "web";
  const ssrWidth = use(SsrViewportContext);

  // Native reads come from useWindowDimensions, which subscribes to rotation /
  // split-screen / resize and tears the listener down for us — no manual
  // Dimensions.addEventListener to leak. On web we ignore it and drive layout
  // from the SSR context + the resize listener below so hydration stays exact.
  const native = useWindowDimensions();

  // Lazy initializer: both server and client first render compute identical
  // flags from the context value, so hydration matches.
  const [dimensions, setDimensions] = useState<WindowDimensions>(() =>
    calculateDimensionFlags(ssrWidth, SSR_VIEWPORT_DEFAULT_HEIGHT)
  );

  // Web: read the real viewport after mount and follow resize events. Keeping
  // this in an effect (not render) preserves the SSR-matched first paint.
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
