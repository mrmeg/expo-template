import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "../stores/authStore";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { AuthScreen } from "./AuthScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

interface AuthWrapperProps {
  children: React.ReactNode;
  /** Component to render when not authenticated. Defaults to AuthScreen. */
  fallback?: React.ReactNode;
  /** Show loading indicator while checking auth state */
  showLoading?: boolean;
}

export function AuthWrapper({
  children,
  fallback,
  showLoading = true,
}: AuthWrapperProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { state } = useAuthStore();
  const { checkAuthState } = useAuth();

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  if (state === "loading" && showLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (state !== "authenticated") {
    // Use provided fallback or default to AuthScreen
    return <>{fallback ?? <AuthScreen />}</>;
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

export default AuthWrapper;
