import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { VerifyEmailForm } from "./VerifyEmailForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { DismissKeyboard } from "@/client/components/ui/DismissKeyboard";
import { SerifText } from "@/client/components/ui/StyledText";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";

type AuthView = "sign-in" | "sign-up" | "forgot-password" | "verify-email" | "reset-password";

interface AuthScreenProps {
  /** Initial view to show */
  initialView?: AuthView;
  /** Callback when authentication succeeds */
  onAuthenticated?: () => void;
}

export function AuthScreen({
  initialView = "sign-in",
  onAuthenticated,
}: AuthScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { signIn, signUp, confirmSignUp, resendCode, forgotPassword, resetPassword } = useAuth();

  const [view, setView] = useState<AuthView>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState(""); // Store password for post-verification sign-in
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  // Track where to redirect after email verification
  const [postVerifyDestination, setPostVerifyDestination] = useState<"sign-in" | "forgot-password">("sign-in");

  // Sign In
  const handleSignIn = async (data: { email: string; password: string }) => {
    setLoading(true);
    setError("");

    try {
      const result = await signIn(data);

      if (result.isSignedIn) {
        onAuthenticated?.();
      } else if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        setPendingEmail(data.email);
        setPendingPassword(data.password);
        setPostVerifyDestination("sign-in");
        try {
          const resendResult = await resendCode(data.email);
          console.log("Resend verification code result:", JSON.stringify(resendResult, null, 2));
        } catch (resendErr: any) {
          console.log("Resend verification code error:", resendErr.name, resendErr.message);
        }
        setView("verify-email");
      }
    } catch (err: any) {
      // Handle unverified user - resend code and redirect to verification screen
      if (err.name === "UserNotConfirmedException") {
        setPendingEmail(data.email);
        setPendingPassword(data.password);
        setPostVerifyDestination("sign-in");
        try {
          const resendResult = await resendCode(data.email);
          console.log("Resend verification code result:", JSON.stringify(resendResult, null, 2));
        } catch (resendErr: any) {
          console.log("Resend verification code error:", resendErr.name, resendErr.message);
        }
        setView("verify-email");
        return;
      }

      // Handle other common errors
      if (err.name === "NotAuthorizedException") {
        setError("Incorrect email or password.");
      } else if (err.name === "UserNotFoundException") {
        setError("No account found with this email.");
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign Up
  const handleSignUp = async (data: { name: string; email: string; password: string }) => {
    setLoading(true);
    setError("");

    try {
      const result = await signUp({ email: data.email, password: data.password });

      if (result.isSignUpComplete) {
        setView("sign-in");
      } else if (result.nextStep?.signUpStep === "CONFIRM_SIGN_UP") {
        setPendingEmail(data.email);
        setPostVerifyDestination("sign-in");
        setView("verify-email");
      }
    } catch (err: any) {
      if (err.name === "UsernameExistsException") {
        setError("An account with this email already exists.");
      } else if (err.name === "InvalidPasswordException") {
        setError("Password does not meet requirements.");
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify Email
  const handleVerify = async (code: string) => {
    if (!pendingEmail) {
      setError("Email not found. Please sign up again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("Verifying email:", pendingEmail);
      const result = await confirmSignUp({ email: pendingEmail, code }) as any;
      console.log("Verification result:", JSON.stringify(result, null, 2));

      if (result.isSignUpComplete) {
        // Check if auto sign-in was successful (works for same-session verification)
        if (result.autoSignedIn) {
          console.log("Auto sign-in successful, calling onAuthenticated...");
          setPendingPassword(""); // Clear stored password
          onAuthenticated?.();
        } else if (pendingPassword) {
          // Auto sign-in failed but we have stored credentials from sign-in attempt
          // This happens when user tried to sign in while unverified, then verified
          console.log("Auto sign-in not available, signing in with stored credentials...");
          try {
            const signInResult = await signIn({ email: pendingEmail, password: pendingPassword });
            setPendingPassword(""); // Clear stored password
            if (signInResult.isSignedIn) {
              console.log("Manual sign-in successful after verification");
              onAuthenticated?.();
            } else {
              setView("sign-in");
            }
          } catch (signInErr) {
            console.log("Sign-in after verification failed:", signInErr);
            setPendingPassword(""); // Clear stored password
            setView("sign-in");
          }
        } else {
          // Redirect based on how the user got to verification
          if (postVerifyDestination === "forgot-password") {
            console.log("Verification complete, redirecting to forgot-password...");
            setForgotPasswordSuccess(false);
            setView("forgot-password");
          } else {
            console.log("Auto sign-in not available, redirecting to sign-in...");
            setView("sign-in");
          }
        }
        setError("");
      }
    } catch (err: any) {
      console.log("Verification error:", err);
      if (err.name === "CodeMismatchException") {
        setError("Invalid verification code. Please try again.");
      } else if (err.name === "ExpiredCodeException") {
        setError("Verification code has expired. Please request a new one.");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!pendingEmail) return;

    setResending(true);
    setError("");

    try {
      await resendCode(pendingEmail);
    } catch (err: any) {
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Forgot Password
  const handleForgotPassword = async (email: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await forgotPassword(email);

      console.log("ForgotPassword nextStep:", result.nextStep);
      if (result.nextStep?.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE") {
        console.log("ForgotPassword: code delivery details:", JSON.stringify(result.nextStep));
        setPendingEmail(email);
        setView("reset-password");
      } else {
        console.log("ForgotPassword: unexpected nextStep, showing success screen");
        setPendingEmail(email);
        setForgotPasswordSuccess(true);
      }
    } catch (err: any) {
      console.log("ForgotPassword error:", err.name, err.message);
      if (err.name === "UserNotFoundException") {
        // Don't reveal if user exists
        setPendingEmail(email);
        setForgotPasswordSuccess(true);
      } else if (err.name === "LimitExceededException") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to send reset code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset Password
  const handleResetPassword = async ({ code, newPassword }: { code: string; newPassword: string }) => {
    if (!pendingEmail) {
      setError("Email not found. Please start the password reset process again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword({ email: pendingEmail, code, newPassword });
      setResetPasswordSuccess(true);
    } catch (err: any) {
      if (err.name === "CodeMismatchException") {
        setError("Invalid code. Please check your email and try again.");
      } else if (err.name === "ExpiredCodeException") {
        setError("Code has expired. Please request a new password reset.");
      } else if (err.name === "InvalidPasswordException") {
        setError("Password does not meet requirements.");
      } else {
        setError(err.message || "Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Navigation helpers
  const goToSignIn = () => {
    setError("");
    setPendingPassword("");
    setPostVerifyDestination("sign-in");
    setForgotPasswordSuccess(false);
    setResetPasswordSuccess(false);
    setView("sign-in");
  };

  const goToSignUp = () => {
    setError("");
    setPendingPassword("");
    setPostVerifyDestination("sign-in");
    setView("sign-up");
  };

  const goToForgotPassword = () => {
    setError("");
    setPendingPassword("");
    setForgotPasswordSuccess(false);
    setView("forgot-password");
  };

  const goToChangeEmail = () => {
    setError("");
    setPendingEmail("");
    setPendingPassword("");
    setPostVerifyDestination("sign-in");
    setView("sign-up");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <DismissKeyboard style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <SerifText size="xl" style={{ color: theme.colors.accent }}>
            Neurospicy OS
          </SerifText>
        </View>

        {view === "sign-in" && (
          <SignInForm
            onSignIn={handleSignIn}
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
            onSignUp={handleSignUp}
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
            onVerify={handleVerify}
            onResendCode={handleResendCode}
            onBack={postVerifyDestination === "forgot-password" ? goToForgotPassword : goToSignIn}
            onChangeEmail={postVerifyDestination === "forgot-password" ? undefined : goToChangeEmail}
            loading={loading}
            resending={resending}
            error={error}
            title={postVerifyDestination === "forgot-password" ? "Verify your email first" : undefined}
            description={postVerifyDestination === "forgot-password"
              ? "Your email needs to be verified before you can reset your password. We've sent a verification code."
              : undefined}
            embedded
          />
        )}

        {view === "forgot-password" && (
          <ForgotPasswordForm
            onSubmit={handleForgotPassword}
            onBack={goToSignIn}
            loading={loading}
            error={error}
            success={forgotPasswordSuccess}
            embedded
          />
        )}

        {view === "reset-password" && (
          <ResetPasswordForm
            onSubmit={handleResetPassword}
            onBack={goToSignIn}
            loading={loading}
            error={error}
            success={resetPasswordSuccess}
            description={`Enter the code sent to ${pendingEmail} and choose a new password.`}
            embedded
          />
        )}
      </DismissKeyboard>
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

export default AuthScreen;
