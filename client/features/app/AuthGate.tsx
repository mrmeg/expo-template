import React, { Suspense } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { isAuthEnabled } from "./isAuthEnabled";

/**
 * Protected-surface gate.
 *
 * Wrap a screen or subtree in <AuthGate> to require an authenticated session.
 * When auth is not configured in the environment (see isAuthEnabled), the gate
 * is a no-op so the template stays explorable in development. When auth *is*
 * configured, unauthenticated users see the shared AuthScreen; loading states
 * show a spinner so there's no flash between tabs.
 *
 * This is intentionally thinner than client/features/auth/AuthWrapper because
 * startup-level auth initialization is owned by useAppStartup. AuthGate only
 * reads the already-resolved auth state.
 *
 * The AuthScreen is a lazy `import()` of the auth components barrel, not a
 * static import: this gate is reachable from the profile tab, so a static
 * import puts the screen and its five forms (~57 kB raw) on the first-render
 * download path of every route — including for signed-in users who never see
 * them. The specifier must stay `@/client/features/auth/components` (the barrel
 * documents why) so this gate, the auth-demo route and the showcase gallery
 * share one async chunk instead of getting hoisted into eager `__common`. The
 * cost is a spinner on the first signed-out render, which is the same
 * loading UI this gate already shows while auth state resolves.
 */
const AuthScreen = React.lazy(async () => ({
  default: (await import("@/client/features/auth/components")).AuthScreen,
}));

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const state = useAuthStore((s) => s.state);

  if (!isAuthEnabled()) {
    return <>{children}</>;
  }

  const loading = (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );

  if (state === "loading") {
    return loading;
  }

  if (state !== "authenticated") {
    return (
      <Suspense fallback={loading}>
        <AuthScreen />
      </Suspense>
    );
  }

  return <>{children}</>;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
  });

const themedStyles = createThemedStyles(createStyles);
