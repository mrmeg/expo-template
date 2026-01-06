import { useCallback } from "react";
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  autoSignIn,
} from "aws-amplify/auth";
import { useAuthStore } from "@/client/stores/authStore";

export function useAuth() {
  const { initialize, setPendingVerificationEmail, setError } = useAuthStore();

  /**
   * Check if user is currently authenticated
   */
  const checkAuthState = useCallback(async () => {
    await initialize();
  }, [initialize]);

  /**
   * Sign in with email and password
   */
  const handleSignIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const result = await signIn({ username: email, password });

    if (result.isSignedIn) {
      await initialize();
    }

    return result;
  }, [initialize]);

  /**
   * Sign up with email and password
   */
  const handleSignUp = useCallback(async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
        },
        // Enable auto sign-in after email verification
        autoSignIn: true,
      },
    });

    console.log("signUp result:", JSON.stringify(result, null, 2));

    // Store email for verification screen
    if (!result.isSignUpComplete) {
      setPendingVerificationEmail(email);
    }

    return result;
  }, [setPendingVerificationEmail]);

  /**
   * Confirm sign up with verification code
   */
  const handleConfirmSignUp = useCallback(async ({
    email,
    code,
  }: {
    email: string;
    code: string;
  }) => {
    const result = await confirmSignUp({
      username: email,
      confirmationCode: code,
    });

    console.log("confirmSignUp result:", JSON.stringify(result, null, 2));

    if (result.isSignUpComplete) {
      setPendingVerificationEmail(null);

      // Try auto sign-in - attempt regardless of nextStep since some Cognito configs
      // don't return COMPLETE_AUTO_SIGN_IN but still support autoSignIn
      console.log("Sign up complete, attempting auto sign-in...");
      try {
        const signInResult = await autoSignIn();
        console.log("autoSignIn result:", JSON.stringify(signInResult, null, 2));
        if (signInResult.isSignedIn) {
          console.log("Auto sign-in successful, initializing auth store...");
          await initialize();
          return { ...result, autoSignedIn: true };
        }
      } catch (error) {
        console.log("Auto sign-in not available:", error);
        // Auto sign-in failed, user needs to sign in manually
      }
    }

    return result;
  }, [setPendingVerificationEmail, initialize]);

  /**
   * Resend verification code
   */
  const handleResendCode = useCallback(async (email: string) => {
    return await resendSignUpCode({ username: email });
  }, []);

  /**
   * Request password reset
   */
  const handleForgotPassword = useCallback(async (email: string) => {
    return await resetPassword({ username: email });
  }, []);

  /**
   * Confirm password reset with code and new password
   */
  const handleResetPassword = useCallback(async ({
    email,
    code,
    newPassword,
  }: {
    email: string;
    code: string;
    newPassword: string;
  }) => {
    return await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  }, []);

  /**
   * Sign out current user
   */
  const handleSignOut = useCallback(async () => {
    const { signOut } = useAuthStore.getState();
    await signOut();
  }, []);

  return {
    checkAuthState,
    signIn: handleSignIn,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    resendCode: handleResendCode,
    forgotPassword: handleForgotPassword,
    resetPassword: handleResetPassword,
    signOut: handleSignOut,
  };
}
