import "@/client/lib/gesture-handler";

// Initialize Reactotron in development mode
if (__DEV__) {
  require("@/client/lib/devtools/ReactotronConfig");
}

import { useEffect, useState, type ErrorInfo } from "react";
import { Platform } from "react-native";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useResources } from "@mrmeg/expo-ui/hooks";
import { syncThemeFromEnvironment } from "@mrmeg/expo-ui/state";
import { UIProvider } from "@mrmeg/expo-ui/components/UIProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "@/client/features/keyboard/platform";
import { ErrorBoundary } from "@mrmeg/expo-ui/components/ErrorBoundary";
import { ErrorScreen } from "@/client/components/ErrorScreen";
import { ensureI18nInitialized, initI18n } from "@/client/features/i18n";
import Config from "@/client/config";
import { validateClientEnv } from "@/client/lib/validateEnv";
import { captureException, setupSentry } from "@/client/lib/sentry";
import { useAppStartup, OnboardingGate } from "@/client/features/app";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";

// Surface partial-feature env config (e.g. only one Cognito var set) at
// startup. Always warns, never throws — the template stays runnable when
// optional features are disabled.
validateClientEnv();

// Initialize Sentry — no-op if EXPO_PUBLIC_SENTRY_DSN is not set
setupSentry();

function reportBoundaryError(error: Error, errorInfo: ErrorInfo) {
  captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack ?? undefined,
      },
    },
  });
}

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
  // Initialize English synchronously, during render, so i18next is ready on the
  // server (effects don't run during SSR). Without this, an SSR-reachable
  // screen's `t()` emits raw keys server-side and translations client-side →
  // hydration mismatch. Idempotent; the post-hydration locale upgrade still
  // happens in the initI18n() effect below. See docs/ssr-hydration.md §3.
  ensureI18nInitialized();

  const { scheme } = useTheme();
  const { loaded: fontsLoaded } = useResources();
  const [i18nReady, setI18nReady] = useState(false);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const { ready } = useAppStartup({ fontsLoaded, i18nReady });

  // Initialize i18n
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // Read persisted theme + start the OS color-scheme listener after the
  // first commit. Deferring keeps SSR and the initial client render in
  // sync — see packages/ui/src/state/themeStore.ts.
  useEffect(() => {
    return syncThemeFromEnvironment();
  }, []);

  // Drop the `theme-loading` shield that the blocking script in +html.tsx
  // adds for dark-mode visitors. Once React has committed, the rendered tree
  // is themed correctly and there's no white-flash risk to mitigate.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.classList.remove("theme-loading");
  }, []);

  // Hide splash screen once the full startup gate has resolved — fonts, i18n,
  // onboarding persistence, and (when configured) auth bootstrap.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Block render on native until startup completes so the splash screen stays
  // visible and we don't flash an unstyled tree. On web, render through so
  // SSR ships real content (fonts/i18n come in via useEffect after mount).
  if (Platform.OS !== "web" && !ready) {
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
            <UIProvider>
              <ErrorBoundary
                catchErrors={Config.catchErrors}
                FallbackComponent={ErrorScreen}
                onError={reportBoundaryError}
              >
                {hasSeenOnboarding ? (
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      // Theme-aware backdrop so the white default doesn't
                      // flash through on screen transitions.
                      contentStyle: { backgroundColor: colors[scheme ?? "light"].colors.background },
                    }}
                  >
                    <Stack.Screen name="(main)" />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                ) : (
                  <OnboardingGate />
                )}
              </ErrorBoundary>
            </UIProvider>
          </KeyboardProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
