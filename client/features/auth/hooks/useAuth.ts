import { useCallback } from "react";
import { useAuthStore, initAuth } from "../stores/authStore";
import {
  AuthError,
  getAuthClient,
  type AuthClient,
  type SocialAuthProviderName,
} from "../provider";

async function requireAuthClient(): Promise<AuthClient> {
  const [client] = await Promise.all([getAuthClient(), initAuth()]);
  if (!client) {
    throw new AuthError("unknown", "Auth is not configured in this environment");
  }
  return client;
}

export function useAuth() {
  const { initialize, setPendingVerificationEmail } = useAuthStore();

  /**
   * Check if user is currently authenticated
   */
  const checkAuthState = useCallback(async () => {
    await initAuth();
    await initialize();
  }, [initialize]);

  /**
   * Sign in with email and password
   */
  const handleSignIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const client = await requireAuthClient();
    const result = await client.signIn({ email, password });

    if (result.status === "complete") {
      await initialize();
    }

    return result;
  }, [initialize]);

  /**
   * Start a passwordless sign-in — the provider emails a one-time code.
   * `needsConfirmation` means the caller should collect the code and call
   * `confirmSignInCode`.
   */
  const handleSignInWithEmailCode = useCallback(async ({ email }: { email: string }) => {
    const client = await requireAuthClient();
    const result = await client.signInWithEmailCode({ email });

    if (result.status === "complete") {
      await initialize();
    }

    return result;
  }, [initialize]);

  /**
   * Finish the in-flight email-code sign-in. The pending challenge lives in the
   * provider SDK, so no email is passed; a rejection means the code was wrong or
   * the challenge is gone and the caller should request a new one.
   */
  const handleConfirmSignInCode = useCallback(async ({ code }: { code: string }) => {
    const client = await requireAuthClient();
    const result = await client.confirmSignInCode({ code });

    await initialize();

    return result;
  }, [initialize]);

  /**
   * Launch a federated sign-in redirect. Resolves once the browser has the
   * redirect; the session lands later through the provider's change events, so
   * callers show a pending state rather than treating this as "signed in".
   */
  const handleSignInWithProvider = useCallback(async (provider: SocialAuthProviderName) => {
    const client = await requireAuthClient();
    await client.signInWithProvider(provider);
  }, []);

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
    const client = await requireAuthClient();
    const result = await client.signUp({ email, password });

    if (result.status === "complete") {
      await initialize();
    } else {
      // Store email for verification screen
      setPendingVerificationEmail(email);
    }

    return result;
  }, [initialize, setPendingVerificationEmail]);

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
    const client = await requireAuthClient();
    const result = await client.confirmSignUp({ email, code });

    setPendingVerificationEmail(null);
    if (result.autoSignedIn) {
      await initialize();
    }

    return result;
  }, [setPendingVerificationEmail, initialize]);

  /**
   * Resend verification code
   */
  const handleResendCode = useCallback(async (email: string) => {
    const client = await requireAuthClient();
    await client.resendCode(email);
  }, []);

  /**
   * Request password reset
   */
  const handleForgotPassword = useCallback(async (email: string) => {
    const client = await requireAuthClient();
    return await client.forgotPassword(email);
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
    const client = await requireAuthClient();
    await client.resetPassword({ email, code, newPassword });
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
    signInWithEmailCode: handleSignInWithEmailCode,
    confirmSignInCode: handleConfirmSignInCode,
    signInWithProvider: handleSignInWithProvider,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    resendCode: handleResendCode,
    forgotPassword: handleForgotPassword,
    resetPassword: handleResetPassword,
    signOut: handleSignOut,
  };
}
