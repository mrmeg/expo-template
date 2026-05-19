import { useState, useEffect } from "react";
import { Dimensions, Platform, ScaledSize } from "react-native";

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

// SSR-safe default used for the very first render on both server and client.
// We intentionally do NOT read window.innerWidth synchronously here, even on
// the client: doing so would make the initial client render diverge from the
// SSR HTML (server has no window) and produce hydration mismatches that cascade
// through every responsive component and shift React's useId counter.
// Real dimensions are populated by the useEffect after mount.
const SSR_SAFE_INITIAL: WindowDimensions = calculateDimensionFlags(0, 0);

/**
* Provides a consistent way to access window dimensions and screen size information across mobile and web.
*
*/
export const useDimensions = (): WindowDimensions => {
  const isWeb = Platform.OS === "web";

  // First render returns the SSR-safe value so server and client agree.
  // The useEffect below replaces it with real dimensions on the client.
  const [dimensions, setDimensions] = useState<WindowDimensions>(SSR_SAFE_INITIAL);

  useEffect(() => {
    const initialDimensions = isWeb
      ? { width: window.innerWidth, height: window.innerHeight }
      : Dimensions.get("window");

    const updateDimensions = (width: number, height: number) => {
      setDimensions(calculateDimensionFlags(width, height));
    };

    updateDimensions(initialDimensions.width, initialDimensions.height);

    if (isWeb) {
      const handleResize = () => {
        updateDimensions(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } else {
      const onChange = ({ window }: { window: ScaledSize }) => {
        updateDimensions(window.width, window.height);
      };
      Dimensions.addEventListener("change", onChange);
    }
  }, [isWeb]);

  return dimensions;
};
