import "@/client/lib/gesture-handler";
import "@/amplify";

// Initialize Reactotron in development mode
if (__DEV__) {
  require("@/client/devtools/ReactotronConfig");
}

import { useEffect, useState } from "react";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/client/constants/colors";
import { useTheme } from "@/client/hooks/useTheme";
import { useResources } from "@/client/hooks/useResources";
import { Notification } from "@/client/components/ui/Notification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from "@rn-primitives/portal";
import { StatusBar } from "@/client/components/ui/StatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/client/components/ui/ErrorBoundary";
import { ErrorScreen } from "@/client/components/ErrorScreen";
import { initI18n } from "@/client/i18n";
import Config from "@/client/config";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded: fontsLoaded } = useResources();
  const [i18nReady, setI18nReady] = useState(false);

  // Initialize i18n
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // Hide splash screen when everything is ready
  useEffect(() => {
    if (fontsLoaded && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, i18nReady]);

  if (!fontsLoaded || !i18nReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={{
          dark: colors[scheme ?? "light"].dark,
          colors: colors[scheme ?? "light"].navigation,
          fonts: colors[scheme ?? "light"].fonts,
        }}>
          <KeyboardProvider>
            <ErrorBoundary catchErrors={Config.catchErrors} FallbackComponent={ErrorScreen}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(main)" />
              </Stack>
            </ErrorBoundary>
            <StatusBar />
          </KeyboardProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      <Notification />
      <PortalHost />
    </QueryClientProvider>
  );
}
