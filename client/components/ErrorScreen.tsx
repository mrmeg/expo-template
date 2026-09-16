import React, { ErrorInfo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import { MonoText, SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { palette } from "@mrmeg/expo-ui/constants";

export interface ErrorScreenProps {
  /**
   * The error that was thrown
   */
  error: Error;
  /**
   * Additional error info from React's error boundary
   */
  errorInfo: ErrorInfo | null;
  /**
   * Function to reset the error state and try again
   */
  resetError: () => void;
}

/**
 * ErrorScreen displays a user-friendly error message with options to retry.
 * Used as the FallbackComponent for ErrorBoundary.
 *
 * Features:
 * - User-friendly error message
 * - Technical details in expandable section (for developers)
 * - Retry button to reset the app
 * - Themed styling
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary catchErrors="always" FallbackComponent={ErrorScreen}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export function ErrorScreen({ error, errorInfo, resetError }: ErrorScreenProps) {
  const { theme, getShadowStyle } = useTheme();
  const styles = themedStyles(theme);
  const [showDetails, setShowDetails] = React.useState(__DEV__);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon placeholder */}
        <View style={styles.iconContainer}>
          <SansSerifBoldText size="display" style={styles.icon}>!</SansSerifBoldText>
        </View>

        {/* Main message */}
        <SansSerifBoldText semantic="heading" style={styles.title}>
          Something went wrong
        </SansSerifBoldText>

        <SansSerifText style={styles.subtitle}>
          We encountered an unexpected error. Please try again, or contact support if the problem persists.
        </SansSerifText>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <Button
            preset="default"
            onPress={resetError}
            fullWidth
          >
            <SansSerifBoldText style={styles.buttonText}>
              Try Again
            </SansSerifBoldText>
          </Button>

          {/* Toggle details (dev mode) */}
          {__DEV__ && (
            <Button
              preset="ghost"
              onPress={() => setShowDetails(!showDetails)}
              style={styles.detailsToggle}
            >
              <SansSerifText size="base" style={styles.detailsToggleText}>
                {showDetails ? "Hide Details" : "Show Details"}
              </SansSerifText>
            </Button>
          )}
        </View>

        {/* Error details (collapsible in dev) */}
        {showDetails && (
          <View style={[styles.errorDetails, getShadowStyle("subtle")]}>
            <ScrollView style={styles.errorScroll}>
              <SansSerifBoldText size="sm" style={styles.errorLabel}>
                Error:
              </SansSerifBoldText>
              <MonoText size="xs" style={styles.errorText}>
                {error.message}
              </MonoText>

              {error.stack && (
                <>
                  <SansSerifBoldText size="sm" style={[styles.errorLabel, styles.stackLabel]}>
                    Stack Trace:
                  </SansSerifBoldText>
                  <MonoText size="xs" style={styles.errorText}>
                    {error.stack}
                  </MonoText>
                </>
              )}

              {errorInfo?.componentStack && (
                <>
                  <SansSerifBoldText size="sm" style={[styles.errorLabel, styles.stackLabel]}>
                    Component Stack:
                  </SansSerifBoldText>
                  <MonoText size="xs" style={styles.errorText}>
                    {errorInfo.componentStack}
                  </MonoText>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.destructive,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    icon: {
      color: palette.white,
    },
    title: {
      color: theme.colors.foreground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginBottom: spacing.xl,
      maxWidth: 300,
    },
    buttonContainer: {
      width: "100%",
      maxWidth: 300,
      alignItems: "center",
    },
    buttonText: {
      color: theme.colors.primaryForeground,
    },
    detailsToggle: {
      marginTop: spacing.md,
    },
    detailsToggleText: {
      color: theme.colors.primary,
    },
    errorDetails: {
      marginTop: spacing.xl,
      width: "100%",
      maxHeight: 300,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    errorScroll: {
      flex: 1,
    },
    errorLabel: {
      color: theme.colors.destructive,
      marginBottom: spacing.xs,
    },
    stackLabel: {
      marginTop: spacing.md,
    },
    errorText: {
      color: theme.colors.foreground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
