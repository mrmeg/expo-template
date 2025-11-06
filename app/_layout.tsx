import "@/lib/gesture-handler";
import { useEffect } from "react";
import { Platform } from "react-native";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import { colors } from "@/constants/colors";
import { useTheme } from "@/hooks/useTheme";
import { useResources } from "@/hooks/useResources";
import { Notification } from "@/components/ui/Notification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MaxWidthContainer } from "@/components/ui/MaxWidthContainer";
import { PortalHost } from "@rn-primitives/portal";
import { StatusBar } from "@/components/ui/StatusBar";
import { NavigationBarBackground } from "@/components/ui/NavigationBarBackground";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { scheme, theme } = useTheme();
  const { loaded } = useResources();

  // Set Android navigation bar theme
  if (Platform.OS === "android") {
    NavigationBar.setBackgroundColorAsync(theme.colors.background);
    NavigationBar.setButtonStyleAsync(scheme === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={colors[scheme ?? "light"]}>
          <MaxWidthContainer>
            <Stack>
              <Stack.Screen name="index" />
            </Stack>
          </MaxWidthContainer>
          <StatusBar />
          <NavigationBarBackground />
        </ThemeProvider>
      </SafeAreaProvider>
      <Notification />
      <PortalHost />
    </QueryClientProvider>
  );
}
