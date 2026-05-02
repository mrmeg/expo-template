import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { AuthScreen } from "@/client/features/auth/components/AuthScreen";
import { useTheme } from "@mrmeg/expo-ui/hooks";
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
 */
interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const state = useAuthStore((s) => s.state);

  if (!isAuthEnabled()) {
    return <>{children}</>;
  }

  if (state === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (state !== "authenticated") {
    return <AuthScreen />;
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
