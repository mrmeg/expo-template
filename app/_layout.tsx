import "@/lib/gesture-handler/gesture-handler";
import { useEffect } from "react";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/constants/colors";
import { useTheme } from "@/hooks/useTheme";
import { useResources } from "@/hooks/useResources";
import { Notification } from "@/components/ui/Notification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded } = useResources();

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
      <ThemeProvider value={colors[scheme ?? "light"]}>
        <Stack>
          <Stack.Screen name="index" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      <Notification />
    </QueryClientProvider>
  );
}
