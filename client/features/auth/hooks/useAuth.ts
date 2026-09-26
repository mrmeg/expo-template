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

/**
 * The provider just established a session, so the store must re-read it even
 * inside the throttle window (see `InitializeOptions.force`).
 */
const SESSION_CHANGED = { force: true } as const;

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
      await initialize(SESSION_CHANGED);
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
      await initialize(SESSION_CHANGED);
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

    await initialize(SESSION_CHANGED);

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
   * Sign up with an email address, optionally with a password.
   *
   * Omitting the password creates a passwordless account: the emailed
   * confirmation code finishes sign-up, and `signInWithEmailCode` is how that
   * account signs in from then on.
   */
  const handleSignUp = useCallback(async ({
    email,
    password,
  }: {
    email: string;
    password?: string;
  }) => {
    const client = await requireAuthClient();
    const result = await client.signUp({ email, password });

    if (result.status === "complete") {
      await initialize(SESSION_CHANGED);
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
      await initialize(SESSION_CHANGED);
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

  /**
   * Delete the account at the provider, then drop the local session. Rejects
   * with `AuthError("unsupported")` when the active client cannot delete from
   * the app; the profile screen hides its row in that case
   * (`useAccountCapabilities`). The provider-side sign-out may fail after the
   * user is gone; the store is reset regardless so the gate shows the sign-in
   * screen.
   */
  const handleDeleteAccount = useCallback(async () => {
    const client = await requireAuthClient();
    if (!client.deleteAccount) {
      throw new AuthError("unsupported", "This auth provider cannot delete accounts from the app");
    }
    await client.deleteAccount();
    try {
      await useAuthStore.getState().signOut();
    } catch {
      useAuthStore.getState().reset();
    }
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
    deleteAccount: handleDeleteAccount,
  };
}
