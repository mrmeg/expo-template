import { useTheme } from "@/hooks/useTheme";
import { StatusBar as RNStatusBar, Platform } from "react-native";

export const StatusBar = () => {
  const { scheme, theme } = useTheme();

  return (
    <RNStatusBar
      barStyle={scheme === "dark" ? "light-content" : "dark-content"}
      backgroundColor={Platform.OS === "android" ? theme.colors.card : undefined}
      translucent={false}
    />
  );
};
