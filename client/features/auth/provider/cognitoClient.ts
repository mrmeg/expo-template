/**
 * Cognito (AWS Amplify) implementation of `AuthClient`.
 *
 * Owns everything Amplify-specific: `Amplify.configure`, the Hub listener,
 * the post-confirmation `autoSignIn` dance, and mapping Amplify result
 * shapes / exception names onto the normalized contract in `types.ts`.
 * All `aws-amplify` imports are dynamic so the SDK loads only when Cognito
 * is the active provider.
 */

import { logDev } from "@/client/lib/devtools";
import type { User } from "../stores/authStore";
import {
  AuthError,
  type AuthChangeEvent,
  type AuthClient,
  type AuthErrorCode,
  type AuthFlowResult,
  type ConfirmSignUpResult,
  type ForgotPasswordResult,
} from "./types";

type AmplifyAuthModule = typeof import("aws-amplify/auth");

const ERROR_CODE_BY_NAME: Record<string, AuthErrorCode> = {
  UserNotConfirmedException: "userNotConfirmed",
  NotAuthorizedException: "incorrectCredentials",
  UserNotFoundException: "userNotFound",
  UsernameExistsException: "userExists",
  InvalidPasswordException: "invalidPassword",
  CodeMismatchException: "codeMismatch",
  ExpiredCodeException: "codeExpired",
  LimitExceededException: "limitExceeded",
};

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return new AuthError(ERROR_CODE_BY_NAME[name] ?? "unknown", message);
}

async function withAuthErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw toAuthError(error);
  }
}

export function createCognitoAuthClient(): AuthClient {
  let initPromise: Promise<void> | null = null;
  const listeners = new Set<(event: AuthChangeEvent) => void>();

  const emit = (event: AuthChangeEvent) => {
    for (const listener of listeners) listener(event);
  };

  async function configure(): Promise<void> {
    const userPoolId = process.env.EXPO_PUBLIC_USER_POOL_ID;
    const userPoolClientId = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;

    if (!userPoolId || !userPoolClientId) {
      const missing = [
        !userPoolId && "EXPO_PUBLIC_USER_POOL_ID",
        !userPoolClientId && "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
      ].filter(Boolean).join(", ");

      if (__DEV__) {
        console.warn(`⚠️ Auth disabled — missing env vars: ${missing}`);
        return;
      }
      throw new Error(`Auth configuration failed — missing env vars: ${missing}`);
    }

    const { Amplify } = await import("aws-amplify");
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    });

    // The Hub listener lives for the process; consumers attach and detach
    // via onAuthChange without touching the underlying subscription.
    const { Hub } = await import("aws-amplify/utils");
    Hub.listen("auth", ({ payload }) => {
      const { event } = payload;
      logDev("Hub auth event:", event);

      switch (event) {
      case "signInWithRedirect":
      case "signedIn":
        emit({ type: "signedIn" });
        break;
      case "signedOut":
        emit({ type: "signedOut" });
        break;
      case "tokenRefresh_failure":
      case "signInWithRedirect_failure":
        emit({ type: "sessionExpired" });
        break;
      }
    });
  }

  async function auth(): Promise<AmplifyAuthModule> {
    await client.init();
    return import("aws-amplify/auth");
  }

  const client: AuthClient = {
    init() {
      if (!initPromise) initPromise = configure();
      return initPromise;
    },

    async getCurrentUser(): Promise<User | null> {
      try {
        const { getCurrentUser } = await auth();
        const current = await getCurrentUser();
        return {
          userId: current.userId,
          username: current.username,
          email: current.signInDetails?.loginId,
        };
      } catch {
        return null;
      }
    },

    async getToken(): Promise<string | null> {
      try {
        const { fetchAuthSession } = await auth();
        const session = await fetchAuthSession();
        return session.tokens?.accessToken?.toString() ?? null;
      } catch {
        return null;
      }
    },

    async signIn({ email, password }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const { signIn } = await auth();
        const result = await signIn({ username: email, password });
        if (result.isSignedIn) return { status: "complete" };
        if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          return { status: "needsConfirmation" };
        }
        throw new AuthError(
          "unknown",
          `Unsupported sign-in step: ${result.nextStep?.signInStep ?? "none"}`,
        );
      });
    },

    async signUp({ email, password }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const { signUp } = await auth();
        const result = await signUp({
          username: email,
          password,
          options: {
            userAttributes: { email },
            // Enable auto sign-in after email verification
            autoSignIn: true,
          },
        });
        return result.isSignUpComplete
          ? { status: "complete" }
          : { status: "needsConfirmation" };
      });
    },

    async confirmSignUp({ email, code }): Promise<ConfirmSignUpResult> {
      return withAuthErrors(async () => {
        const { confirmSignUp, autoSignIn } = await auth();
        const result = await confirmSignUp({
          username: email,
          confirmationCode: code,
        });

        if (!result.isSignUpComplete) {
          throw new AuthError(
            "unknown",
            `Confirmation incomplete: ${result.nextStep?.signUpStep ?? "unknown step"}`,
          );
        }

        // Attempt auto sign-in regardless of nextStep — some Cognito configs
        // don't return COMPLETE_AUTO_SIGN_IN but still support it.
        try {
          const signInResult = await autoSignIn();
          if (signInResult.isSignedIn) {
            return { status: "complete", autoSignedIn: true };
          }
        } catch (error) {
          logDev("Auto sign-in not available:", error);
        }
        return { status: "complete", autoSignedIn: false };
      });
    },

    async resendCode(email): Promise<void> {
      await withAuthErrors(async () => {
        const { resendSignUpCode } = await auth();
        await resendSignUpCode({ username: email });
      });
    },

    async forgotPassword(email): Promise<ForgotPasswordResult> {
      return withAuthErrors(async () => {
        const { resetPassword } = await auth();
        const result = await resetPassword({ username: email });
        return result.nextStep?.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE"
          ? { status: "codeSent" }
          : { status: "done" };
      });
    },

    async resetPassword({ email, code, newPassword }): Promise<void> {
      await withAuthErrors(async () => {
        const { confirmResetPassword } = await auth();
        await confirmResetPassword({
          username: email,
          confirmationCode: code,
          newPassword,
        });
      });
    },

    async signOut(): Promise<void> {
      const { signOut } = await auth();
      await signOut();
    },

    onAuthChange(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };

  return client;
}
