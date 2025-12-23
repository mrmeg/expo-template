import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  /**
   * When to catch errors
   * - "always": Catch in all environments
   * - "dev": Only catch in development
   * - "prod": Only catch in production
   * - "never": Never catch (errors bubble up)
   */
  catchErrors: "always" | "dev" | "prod" | "never";
  /**
   * Child components to render
   */
  children: ReactNode;
  /**
   * Custom error fallback component
   */
  FallbackComponent?: React.ComponentType<{
    error: Error;
    errorInfo: ErrorInfo | null;
    resetError: () => void;
  }>;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary catchErrors="always" FallbackComponent={ErrorScreen}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  /**
   * Determine if errors should be caught based on config and environment
   */
  private shouldCatchErrors(): boolean {
    const { catchErrors } = this.props;

    if (catchErrors === "always") return true;
    if (catchErrors === "never") return false;
    if (catchErrors === "dev") return __DEV__;
    if (catchErrors === "prod") return !__DEV__;

    return true;
  }

  /**
   * Reset the error state to try rendering again
   */
  resetError = () => {
    this.setState({ error: null, errorInfo: null });
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({ errorInfo });

    // Log error to console in development
    if (__DEV__) {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Error info:", errorInfo);
    }

    // Here you could send to an error tracking service like Sentry
    // crashReporting.reportError(error, errorInfo);
  }

  render() {
    const { children, FallbackComponent } = this.props;
    const { error, errorInfo } = this.state;

    // If no error or we shouldn't catch, render children normally
    if (!error || !this.shouldCatchErrors()) {
      return children;
    }

    // If custom fallback component provided, use it
    if (FallbackComponent) {
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
        />
      );
    }

    // Default: just return null (you should provide a FallbackComponent)
    return null;
  }
}
