import { useEffect } from "react";
import { useTheme } from "../hooks/useTheme";
import { StatusBar as RNStatusBar } from "react-native";

export const StatusBar = () => {
  const { scheme, theme } = useTheme();
  const barStyle = scheme === "dark" ? "light-content" : "dark-content";

  /**
   * Switching from system theme to light/dark would not properly update the status bar, so it is done imperatively
   */
  useEffect(() => {
    RNStatusBar.setBarStyle(barStyle, true);
  }, [barStyle]);

  return <RNStatusBar barStyle={barStyle} />;
};
