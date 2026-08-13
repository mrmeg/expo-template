import "@/client/lib/gesture-handler";

// Initialize Reactotron in development mode
if (__DEV__) {
  require("@/client/lib/devtools/ReactotronConfig");
}

import { useEffect, useState, type ErrorInfo } from "react";
import { Platform, StyleSheet } from "react-native";
import { Stack, ThemeProvider, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useResources } from "@mrmeg/expo-ui/hooks";
import { DEFAULT_VIEWPORT_HEIGHT, DEFAULT_VIEWPORT_WIDTH } from "@mrmeg/expo-ui/hooks";
import { syncThemeFromEnvironment } from "@mrmeg/expo-ui/state";
import { UIProvider } from "@mrmeg/expo-ui/components/UIProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardDismissBoundary, KeyboardProvider } from "@/client/features/keyboard/platform";
import { ErrorBoundary } from "@mrmeg/expo-ui/components/ErrorBoundary";
import { ErrorScreen } from "@/client/components/ErrorScreen";
import { ensureI18nInitialized, initI18n } from "@/client/features/i18n";
import Config from "@/client/config";
import { recordPathname } from "@/client/lib/clientNavigation";
import { validateClientEnv } from "@/client/lib/validateEnv";
import { captureException, setupSentry } from "@/client/lib/sentry";
import { useAppStartup, OnboardingGate } from "@/client/features/app";
import { useSafariThemeColorSync } from "@/client/features/app/safariThemeColor";
import { AuthProviderGate } from "@/client/features/auth/provider/AuthProviderGate";
import { useHasSeenOnboarding } from "@/client/features/onboarding/onboardingStore";

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

// `SafeAreaProvider` renders nothing until it has measured, and on web the
// measurement needs a DOM — so the HTML shell `expo export` renders in Node
// would come out empty without a starting frame. Seed web with the same
// desktop default `useDimensions` starts from (so responsive branches and the
// safe-area frame agree) and zero insets, which is the only honest value in a
// browser before the probe element mounts. Real metrics arrive on the first
// layout. Native returns `undefined` to keep SafeAreaProvider on its real
// measurement path — forcing zero insets there would break notch padding.
const WEB_INITIAL_METRICS =
  Platform.OS === "web"
    ? {
      frame: { x: 0, y: 0, width: DEFAULT_VIEWPORT_WIDTH, height: DEFAULT_VIEWPORT_HEIGHT },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }
    : undefined;

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
  // Initialize English synchronously, during render, so i18next is ready for
  // the very first render of any screen (effects run too late, and web's HTML
  // shell is rendered in Node at export time where effects never run at all).
  // Without this a screen's `t()` emits raw keys on that first pass.
  // Idempotent; the locale upgrade still happens in the initI18n() effect
  // below.
  ensureI18nInitialized();

  const { scheme } = useTheme();
  const { loaded: fontsLoaded } = useResources();
  // Web-only inside (no-op elsewhere): keeps <meta name="theme-color"> — the
  // Safari/Chrome chrome tint — tracking the active theme after hydration.
  useSafariThemeColorSync();
  const [i18nReady, setI18nReady] = useState(false);
  // Store state on every platform: web reads localStorage in an effect (see
  // useAppStartup), so returning visitors see the gate for the first frames
  // and then the app shell. See client/features/onboarding/onboardingStore.ts.
  const hasSeenOnboarding = useHasSeenOnboarding();
  const { ready } = useAppStartup({ fontsLoaded, i18nReady });

  // Initialize i18n
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // Read persisted theme + start the OS color-scheme listener after the
  // first commit. Deferring keeps the first render identical to the HTML
  // shell built at export time — see packages/ui/src/state/themeStore.ts.
  useEffect(() => {
    return syncThemeFromEnvironment();
  }, []);

  // Hide splash screen once the full startup gate has resolved — fonts, i18n,
  // onboarding persistence, and (when configured) auth bootstrap.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Block render on native until startup completes so the splash screen stays
  // visible and we don't flash an unstyled tree. On web, render through so the
  // first paint has content (fonts/i18n come in via useEffect after mount).
  if (Platform.OS !== "web" && !ready) {
    return null;
  }

  return (
    <AuthProviderGate>
      <QueryClientProvider client={queryClient}>
        {/* FIRST child: it records the entry pathname during render, and every
            screen that reads that record renders below it. */}
        <RouteIdentityObserver />
        <SafeAreaProvider initialMetrics={WEB_INITIAL_METRICS}>
          <ThemeProvider value={{
            dark: colors[scheme ?? "light"].dark,
            colors: colors[scheme ?? "light"].navigation,
            fonts: colors[scheme ?? "light"].fonts,
          }}>
            <KeyboardProvider>
              <UIProvider>
                <KeyboardDismissBoundary style={styles.keyboardDismissScope}>
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
                </KeyboardDismissBoundary>
              </UIProvider>
            </KeyboardProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </AuthProviderGate>
  );
}

/**
 * Feeds the current pathname to `client/lib/clientNavigation.ts`, which lets a
 * screen tell "the visitor arrived here" (must render exactly what the exported
 * HTML shell did) from "the visitor navigated here" (free to defer expensive
 * work).
 *
 * Its own component, rendering nothing, for one reason: `usePathname()`
 * subscribes to expo-router's route store, so calling it in `RootLayoutContent`
 * would re-render every provider in this file — `ThemeProvider`'s inline `value`
 * object included — on every navigation. Isolated in a childless leaf, a
 * navigation re-renders this and nothing else.
 *
 * The render-body `recordPathname()` call is load-bearing, not a shortcut: it is
 * what guarantees the entry pathname is recorded before any leaf screen renders,
 * including a late selective-hydration pass. The effect only latches the
 * "we have navigated away" half. See clientNavigation.ts for why the previous
 * effect-only version was wrong.
 */
function RouteIdentityObserver() {
  const pathname = usePathname();

  // Idempotent, first-write-wins: safe to call on every render, and the only
  // placement that beats a late-hydrating leaf.
  recordPathname(pathname);

  useEffect(() => {
    recordPathname(pathname);
  }, [pathname]);

  return null;
}

const styles = StyleSheet.create({
  keyboardDismissScope: {
    flex: 1,
    position: "relative",
  },
});
