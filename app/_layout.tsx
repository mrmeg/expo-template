import "@/client/lib/gesture-handler";

// Initialize Reactotron in development mode
if (__DEV__) {
  require("@/client/lib/devtools/ReactotronConfig");
}

import { useEffect, useState } from "react";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useResources } from "@mrmeg/expo-ui/hooks";
import { Notification } from "@mrmeg/expo-ui/components/Notification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from "@rn-primitives/portal";
import { StatusBar } from "@mrmeg/expo-ui/components/StatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "@/client/features/keyboard/platform";
import { ErrorBoundary } from "@mrmeg/expo-ui/components/ErrorBoundary";
import { ErrorScreen } from "@/client/components/ErrorScreen";
import { initI18n } from "@/client/features/i18n";
import Config from "@/client/config";
import { validateClientEnv } from "@/client/lib/validateEnv";
import { setupSentry } from "@mrmeg/expo-ui/lib";
import { useAppStartup, OnboardingGate } from "@/client/features/app";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";

// Surface partial-feature env config (e.g. only one Cognito var set) at
// startup. Always warns, never throws — the template stays runnable when
// optional features are disabled.
validateClientEnv();

// Initialize Sentry — no-op if EXPO_PUBLIC_SENTRY_DSN is not set
setupSentry();

export const unstable_settings = {
  initialRouteName: "(main)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 10,    // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry 4xx errors (client errors)
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded: fontsLoaded } = useResources();
  const [i18nReady, setI18nReady] = useState(false);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const { ready } = useAppStartup({ fontsLoaded, i18nReady });

  // Initialize i18n
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // Hide splash screen once the full startup gate has resolved — fonts, i18n,
  // onboarding persistence, and (when configured) auth bootstrap.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
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
              {hasSeenOnboarding ? (
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(main)" />
                  <Stack.Screen name="+not-found" />
                </Stack>
              ) : (
                <OnboardingGate />
              )}
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
