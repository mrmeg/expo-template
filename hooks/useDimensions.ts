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
* Provides a consistent way to access window dimensions and screen size information across mobile and web.
*
*/
export const useDimensions = (): WindowDimensions => {
  const isWeb = Platform.OS === "web";

  const [dimensions, setDimensions] = useState<WindowDimensions>({
    width: 0,
    height: 0,
    orientation: "portrait",
    isSmallScreen: true,
    isMediumScreen: false,
    isLargeScreen: false,
  });

  useEffect(() => {
    const initialDimensions = isWeb
      ? { width: window.innerWidth, height: window.innerHeight }
      : Dimensions.get("window");

    const updateDimensions = (width: number, height: number) => {
      const orientation = width > height ? "landscape" : "portrait";
      setDimensions({
        width,
        height,
        orientation,
        isSmallScreen: width <= SCREEN_SIZES.SMALL,
        isMediumScreen: width > SCREEN_SIZES.SMALL && width <= SCREEN_SIZES.MEDIUM,
        isLargeScreen: width > SCREEN_SIZES.MEDIUM,
      });
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
