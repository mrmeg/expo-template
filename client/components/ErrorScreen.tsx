import React, { ErrorInfo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import type { Theme } from "@/client/constants/colors";
import { palette } from "@/client/constants/colors";

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
  const styles = createStyles(theme);
  const [showDetails, setShowDetails] = React.useState(__DEV__);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon placeholder */}
        <View style={styles.iconContainer}>
          <SansSerifBoldText style={styles.icon}>!</SansSerifBoldText>
        </View>

        {/* Main message */}
        <SansSerifBoldText style={styles.title}>
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
              <SansSerifText style={styles.detailsToggleText}>
                {showDetails ? "Hide Details" : "Show Details"}
              </SansSerifText>
            </Button>
          )}
        </View>

        {/* Error details (collapsible in dev) */}
        {showDetails && (
          <View style={[styles.errorDetails, getShadowStyle("subtle")]}>
            <ScrollView style={styles.errorScroll}>
              <SansSerifBoldText style={styles.errorLabel}>
                Error:
              </SansSerifBoldText>
              <SansSerifText style={styles.errorText}>
                {error.message}
              </SansSerifText>

              {error.stack && (
                <>
                  <SansSerifBoldText style={[styles.errorLabel, styles.stackLabel]}>
                    Stack Trace:
                  </SansSerifBoldText>
                  <SansSerifText style={styles.errorText}>
                    {error.stack}
                  </SansSerifText>
                </>
              )}

              {errorInfo?.componentStack && (
                <>
                  <SansSerifBoldText style={[styles.errorLabel, styles.stackLabel]}>
                    Component Stack:
                  </SansSerifBoldText>
                  <SansSerifText style={styles.errorText}>
                    {errorInfo.componentStack}
                  </SansSerifText>
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
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.destructive,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    icon: {
      fontSize: 40,
      color: palette.white,
      fontWeight: "bold",
    },
    title: {
      fontSize: 24,
      color: theme.colors.foreground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.foreground,
      opacity: 0.7,
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
      fontSize: 14,
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
      fontSize: 12,
      color: theme.colors.destructive,
      marginBottom: spacing.xs,
    },
    stackLabel: {
      marginTop: spacing.md,
    },
    errorText: {
      fontSize: 11,
      color: theme.colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      lineHeight: 16,
    },
  });
