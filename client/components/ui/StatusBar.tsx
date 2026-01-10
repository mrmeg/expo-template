import { useEffect } from "react";
import { useTheme } from "@/client/hooks/useTheme";
import { StatusBar as RNStatusBar, Platform } from "react-native";

export const StatusBar = () => {
  const { scheme, theme } = useTheme();
  const barStyle = scheme === "dark" ? "light-content" : "dark-content";

  /**
   * Switching from system theme to light/dark would not properly update the status bar, so it is done imperatively
   */
  useEffect(() => {
    RNStatusBar.setBarStyle(barStyle, true);
    if (Platform.OS === "android") {
      RNStatusBar.setBackgroundColor("transparent", true);
      RNStatusBar.setTranslucent(true);
    }
  }, [barStyle]);

  return (
    <RNStatusBar
      barStyle={barStyle}
      backgroundColor={Platform.OS === "android" ? "transparent" : undefined}
      translucent={true}
    />
  );
};
