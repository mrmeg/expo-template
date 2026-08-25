import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { VerifyEmailForm } from "./VerifyEmailForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { DismissKeyboard } from "@mrmeg/expo-ui/components/DismissKeyboard";
import { SerifText } from "@mrmeg/expo-ui/components/StyledText";
import { useAuth } from "../hooks/useAuth";
import { isAuthError } from "../provider";
import { useAuthStore } from "../stores/authStore";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { getAppName } from "@/client/lib/identity";
import { logDev } from "@/client/lib/devtools";

type AuthView = "sign-in" | "sign-up" | "forgot-password" | "verify-email" | "reset-password";
type PostVerifyDestination = "sign-in" | "forgot-password";

type AuthScreenState = {
  view: AuthView;
  loading: boolean;
  error: string;
  pendingEmail: string;
  pendingPassword: string;
  forgotPasswordSuccess: boolean;
  resetPasswordSuccess: boolean;
  resending: boolean;
  postVerifyDestination: PostVerifyDestination;
};

function createInitialAuthScreenState(initialView: AuthView): AuthScreenState {
  return {
    view: initialView,
    loading: false,
    error: "",
    pendingEmail: "",
    pendingPassword: "",
    forgotPasswordSuccess: false,
    resetPasswordSuccess: false,
    resending: false,
    postVerifyDestination: "sign-in",
  };
}

interface AuthScreenProps {
  /** Initial view to show */
  initialView?: AuthView;
  /** Callback when authentication succeeds */
  onAuthenticated?: () => void;
}

async function resendVerificationCode(
  resendCode: ReturnType<typeof useAuth>["resendCode"],
  email: string
) {
  try {
    await resendCode(email);
  } catch (resendErr: any) {
    logDev("Resend verification code error:", resendErr.name, resendErr.message);
  }
}

export function AuthScreen({
  initialView = "sign-in",
  onAuthenticated,
}: AuthScreenProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const appName = getAppName();
  const { signIn, signUp, confirmSignUp, resendCode, forgotPassword, resetPassword } = useAuth();

  const [authScreenState, setAuthScreenState] = useState<AuthScreenState>(() =>
    createInitialAuthScreenState(initialView)
  );
  const {
    view,
    loading,
    error,
    pendingEmail,
    pendingPassword,
    forgotPasswordSuccess,
    resetPasswordSuccess,
    resending,
    postVerifyDestination,
  } = authScreenState;

  /**
   * Merge updater: every transition below moves several fields at once (view
   * plus the pending email/password it has to carry), so patches merge into the
   * latest state instead of replacing it.
   */
  const update = (changes: Partial<AuthScreenState>) => {
    setAuthScreenState((current) => ({ ...current, ...changes }));
  };

  // Sign In
  const handleSignIn = async (data: { email: string; password: string }) => {
    update({ loading: true, error: "" });

    try {
      const result = await signIn(data);

      if (result.status === "complete") {
        onAuthenticated?.();
      } else if (result.status === "needsConfirmation") {
        update({
          pendingEmail: data.email,
          pendingPassword: data.password,
          postVerifyDestination: "sign-in",
        });
        await resendVerificationCode(resendCode, data.email);
        update({ view: "verify-email" });
      }
    } catch (err: any) {
      const code = isAuthError(err) ? err.code : "unknown";

      // Handle unverified user - resend code and redirect to verification screen
      if (code === "userNotConfirmed") {
        update({
          pendingEmail: data.email,
          pendingPassword: data.password,
          postVerifyDestination: "sign-in",
        });
        await resendVerificationCode(resendCode, data.email);
        update({ view: "verify-email" });
        return;
      }

      // Handle other common errors
      if (code === "incorrectCredentials") {
        update({ error: "Incorrect email or password." });
      } else if (code === "userNotFound") {
        update({ error: "No account found with this email." });
      } else {
        update({ error: err.message || "Failed to sign in. Please try again." });
      }
    } finally {
      update({ loading: false });
    }
  };

  // Sign Up
  const handleSignUp = async (data: { name: string; email: string; password: string }) => {
    update({ loading: true, error: "" });

    try {
      const result = await signUp({ email: data.email, password: data.password });

      if (result.status === "complete") {
        // Clerk establishes a session on completed sign-up; Cognito may not
        // (auto-verified pools). handleSignUp already re-initialized the
        // store, so its state tells us which happened.
        if (useAuthStore.getState().state === "authenticated") {
          onAuthenticated?.();
        } else {
          update({ view: "sign-in" });
        }
      } else if (result.status === "needsConfirmation") {
        update({
          pendingEmail: data.email,
          postVerifyDestination: "sign-in",
          view: "verify-email",
        });
      }
    } catch (err: any) {
      const code = isAuthError(err) ? err.code : "unknown";
      if (code === "userExists") {
        update({ error: "An account with this email already exists." });
      } else if (code === "invalidPassword") {
        update({ error: "Password does not meet requirements." });
      } else {
        update({ error: err.message || "Failed to create account. Please try again." });
      }
    } finally {
      update({ loading: false });
    }
  };

  // Verify Email
  const handleVerify = async (code: string) => {
    if (!pendingEmail) {
      update({ error: "Email not found. Please sign up again." });
      return;
    }

    update({ loading: true, error: "" });

    try {
      logDev("Verifying email:", pendingEmail);
      const result = await confirmSignUp({ email: pendingEmail, code });
      logDev("Verification result:", result);

      // Check if auto sign-in was successful (works for same-session verification)
      if (result.autoSignedIn) {
        logDev("Auto sign-in successful, calling onAuthenticated...");
        update({ pendingPassword: "" }); // Clear stored password
        onAuthenticated?.();
      } else if (pendingPassword) {
        // Auto sign-in failed but we have stored credentials from sign-in attempt
        // This happens when user tried to sign in while unverified, then verified
        logDev("Auto sign-in not available, signing in with stored credentials...");
        try {
          const signInResult = await signIn({ email: pendingEmail, password: pendingPassword });
          update({ pendingPassword: "" }); // Clear stored password
          if (signInResult.status === "complete") {
            logDev("Manual sign-in successful after verification");
            onAuthenticated?.();
          } else {
            update({ view: "sign-in" });
          }
        } catch (signInErr) {
          logDev("Sign-in after verification failed:", signInErr);
          update({ pendingPassword: "", view: "sign-in" }); // Clear stored password
        }
      } else if (postVerifyDestination === "forgot-password") {
        // Redirect based on how the user got to verification
        logDev("Verification complete, redirecting to forgot-password...");
        update({ forgotPasswordSuccess: false, view: "forgot-password" });
      } else {
        logDev("Auto sign-in not available, redirecting to sign-in...");
        update({ view: "sign-in" });
      }
      update({ error: "" });
    } catch (err: any) {
      logDev("Verification error:", err);
      const errCode = isAuthError(err) ? err.code : "unknown";
      if (errCode === "codeMismatch") {
        update({ error: "Invalid verification code. Please try again." });
      } else if (errCode === "codeExpired") {
        update({ error: "Verification code has expired. Please request a new one." });
      } else {
        update({ error: err.message || "Verification failed. Please try again." });
      }
    } finally {
      update({ loading: false });
    }
  };

  const handleResendCode = async () => {
    if (!pendingEmail) return;

    update({ resending: true, error: "" });

    try {
      await resendCode(pendingEmail);
    } catch (err: any) {
      update({ error: err.message || "Failed to resend code. Please try again." });
    } finally {
      update({ resending: false });
    }
  };

  // Forgot Password
  const handleForgotPassword = async (email: string) => {
    update({ loading: true, error: "" });

    try {
      const result = await forgotPassword(email);

      logDev("ForgotPassword result:", result.status);
      if (result.status === "codeSent") {
        update({ pendingEmail: email, view: "reset-password" });
      } else {
        logDev("ForgotPassword: no code expected, showing success screen");
        update({ pendingEmail: email, forgotPasswordSuccess: true });
      }
    } catch (err: any) {
      logDev("ForgotPassword error:", err.name, err.message);
      const code = isAuthError(err) ? err.code : "unknown";
      if (code === "userNotFound") {
        // Don't reveal if user exists
        update({ pendingEmail: email, forgotPasswordSuccess: true });
      } else if (code === "limitExceeded") {
        update({ error: "Too many attempts. Please try again later." });
      } else {
        update({ error: err.message || "Failed to send reset code. Please try again." });
      }
    } finally {
      update({ loading: false });
    }
  };

  // Reset Password
  const handleResetPassword = async ({ code, newPassword }: { code: string; newPassword: string }) => {
    if (!pendingEmail) {
      update({ error: "Email not found. Please start the password reset process again." });
      return;
    }

    update({ loading: true, error: "" });

    try {
      await resetPassword({ email: pendingEmail, code, newPassword });
      update({ resetPasswordSuccess: true });
    } catch (err: any) {
      const errCode = isAuthError(err) ? err.code : "unknown";
      if (errCode === "codeMismatch") {
        update({ error: "Invalid code. Please check your email and try again." });
      } else if (errCode === "codeExpired") {
        update({ error: "Code has expired. Please request a new password reset." });
      } else if (errCode === "invalidPassword") {
        update({ error: "Password does not meet requirements." });
      } else {
        update({ error: err.message || "Failed to reset password. Please try again." });
      }
    } finally {
      update({ loading: false });
    }
  };

  // Navigation helpers
  const goToSignIn = () =>
    update({
      error: "",
      pendingPassword: "",
      postVerifyDestination: "sign-in",
      forgotPasswordSuccess: false,
      resetPasswordSuccess: false,
      view: "sign-in",
    });

  const goToSignUp = () =>
    update({
      error: "",
      pendingPassword: "",
      postVerifyDestination: "sign-in",
      view: "sign-up",
    });

  const goToForgotPassword = () =>
    update({
      error: "",
      pendingPassword: "",
      forgotPasswordSuccess: false,
      view: "forgot-password",
    });

  const goToChangeEmail = () =>
    update({
      error: "",
      pendingEmail: "",
      pendingPassword: "",
      postVerifyDestination: "sign-in",
      view: "sign-up",
    });

  return (
    <AuthScreenFrame styles={styles} theme={theme} appName={appName}>
      <AuthViewFields
        view={view}
        loading={loading}
        error={error}
        pendingEmail={pendingEmail}
        forgotPasswordSuccess={forgotPasswordSuccess}
        resetPasswordSuccess={resetPasswordSuccess}
        resending={resending}
        postVerifyDestination={postVerifyDestination}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onVerify={handleVerify}
        onResendCode={handleResendCode}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        goToSignIn={goToSignIn}
        goToSignUp={goToSignUp}
        goToForgotPassword={goToForgotPassword}
        goToChangeEmail={goToChangeEmail}
      />
    </AuthScreenFrame>
  );
}

type AuthScreenStyles = ReturnType<typeof createStyles>;

function AuthScreenFrame({
  styles,
  theme,
  appName,
  children,
}: {
  styles: AuthScreenStyles;
  theme: Theme;
  appName: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <DismissKeyboard style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <SerifText size="xl" style={{ color: theme.colors.accent }}>
            {appName}
          </SerifText>
        </View>

        {children}
      </DismissKeyboard>
    </SafeAreaView>
  );
}

function AuthViewFields({
  view,
  loading,
  error,
  pendingEmail,
  forgotPasswordSuccess,
  resetPasswordSuccess,
  resending,
  postVerifyDestination,
  onSignIn,
  onSignUp,
  onVerify,
  onResendCode,
  onForgotPassword,
  onResetPassword,
  goToSignIn,
  goToSignUp,
  goToForgotPassword,
  goToChangeEmail,
}: {
  view: AuthView;
  loading: boolean;
  error: string;
  pendingEmail: string;
  forgotPasswordSuccess: boolean;
  resetPasswordSuccess: boolean;
  resending: boolean;
  postVerifyDestination: PostVerifyDestination;
  onSignIn: (data: { email: string; password: string }) => Promise<void>;
  onSignUp: (data: { name: string; email: string; password: string }) => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  onResendCode: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onResetPassword: (data: { code: string; newPassword: string }) => Promise<void>;
  goToSignIn: () => void;
  goToSignUp: () => void;
  goToForgotPassword: () => void;
  goToChangeEmail: () => void;
}) {
  return (
    <>
      {view === "sign-in" && (
        <SignInForm
          onSignIn={onSignIn}
          onForgotPassword={goToForgotPassword}
          onSignUp={goToSignUp}
          loading={loading}
          error={error}
          socialProviders={[]}
          embedded
        />
      )}

      {view === "sign-up" && (
        <SignUpForm
          onSignUp={onSignUp}
          onSignIn={goToSignIn}
          loading={loading}
          error={error}
          socialProviders={[]}
          requireName={false}
          embedded
        />
      )}

      {view === "verify-email" && (
        <VerifyEmailForm
          email={pendingEmail}
          onVerify={onVerify}
          onResendCode={onResendCode}
          onBack={
            postVerifyDestination === "forgot-password"
              ? goToForgotPassword
              : goToSignIn
          }
          onChangeEmail={
            postVerifyDestination === "forgot-password"
              ? undefined
              : goToChangeEmail
          }
          loading={loading}
          resending={resending}
          error={error}
          title={
            postVerifyDestination === "forgot-password"
              ? "Verify your email first"
              : undefined
          }
          description={
            postVerifyDestination === "forgot-password"
              ? "Your email needs to be verified before you can reset your password. We've sent a verification code."
              : undefined
          }
          embedded
        />
      )}

      {view === "forgot-password" && (
        <ForgotPasswordForm
          onSubmit={onForgotPassword}
          onBack={goToSignIn}
          loading={loading}
          error={error}
          success={forgotPasswordSuccess}
          embedded
        />
      )}

      {view === "reset-password" && (
        <ResetPasswordForm
          onSubmit={onResetPassword}
          onBack={goToSignIn}
          loading={loading}
          error={error}
          success={resetPasswordSuccess}
          description={`Enter the code sent to ${pendingEmail} and choose a new password.`}
          embedded
        />
      )}
    </>
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
    },
    logoContainer: {
      alignItems: "center",
      paddingTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: spacing.radiusLg,
      marginBottom: spacing.sm,
    },
  });

const themedStyles = createThemedStyles(createStyles);

export default AuthScreen;
