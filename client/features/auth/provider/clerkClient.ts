/**
 * Clerk implementation of `AuthClient`.
 *
 * Uses `getClerkInstance()` — Clerk's imperative singleton accessor — rather
 * than React hooks, so the store-driven architecture keeps working unchanged.
 * The singleton is initialized by the `ClerkProvider` mounted in RootLayout
 * when Clerk is the active provider; `init()` waits for it to hydrate.
 *
 * Flow mapping (email + password with emailed verification code, matching
 * the existing screens):
 *   signIn        → clerk.client.signIn.create({ identifier, password })
 *   signUp        → clerk.client.signUp.create({ emailAddress, password })
 *                   + prepareEmailAddressVerification({ strategy: "email_code" })
 *   confirmSignUp → signUp.attemptEmailAddressVerification; setActive on the
 *                   created session, so autoSignedIn is always true.
 *   forgot/reset  → signIn.create({ strategy: "reset_password_email_code" })
 *                   + attemptFirstFactor with code and new password.
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

type ClerkInstance = ReturnType<typeof import("@clerk/clerk-expo").getClerkInstance>;

const ERROR_CODE_BY_CLERK_CODE: Record<string, AuthErrorCode> = {
  form_identifier_not_found: "userNotFound",
  form_password_incorrect: "incorrectCredentials",
  form_identifier_exists: "userExists",
  form_password_pwned: "invalidPassword",
  form_password_length_too_short: "invalidPassword",
  form_password_validation_failed: "invalidPassword",
  form_code_incorrect: "codeMismatch",
  verification_expired: "codeExpired",
  verification_failed: "codeMismatch",
  too_many_requests: "limitExceeded",
};

interface ClerkApiErrorShape {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const first = (error as ClerkApiErrorShape)?.errors?.[0];
  if (first) {
    const code = ERROR_CODE_BY_CLERK_CODE[first.code ?? ""] ?? "unknown";
    return new AuthError(code, first.longMessage ?? first.message ?? "Authentication failed");
  }
  const message = error instanceof Error ? error.message : String(error);
  return new AuthError("unknown", message);
}

async function withAuthErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw toAuthError(error);
  }
}

export function createClerkAuthClient(): AuthClient {
  let initPromise: Promise<ClerkInstance> | null = null;

  async function loadClerk(): Promise<ClerkInstance> {
    const { getClerkInstance } = await import("@clerk/clerk-expo");
    const clerk = getClerkInstance();

    // ClerkProvider (RootLayout) owns loading; poll until the singleton has
    // hydrated its session so getCurrentUser/getToken don't race startup.
    if (!clerk.loaded) {
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (clerk.loaded || Date.now() - started > 10_000) {
            resolve();
            return;
          }
          setTimeout(tick, 50);
        };
        tick();
      });
      if (!clerk.loaded) {
        logDev("Clerk did not finish loading within 10s; continuing unauthenticated");
      }
    }
    return clerk;
  }

  function clerkInstance(): Promise<ClerkInstance> {
    if (!initPromise) initPromise = loadClerk();
    return initPromise;
  }

  function toUser(clerk: ClerkInstance): User | null {
    const clerkUser = clerk.user;
    if (!clerkUser || !clerk.session) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress
      ?? clerkUser.emailAddresses[0]?.emailAddress;
    return {
      userId: clerkUser.id,
      username: clerkUser.username ?? email ?? clerkUser.id,
      email,
    };
  }

  const client: AuthClient = {
    async init() {
      await clerkInstance();
    },

    async getCurrentUser(): Promise<User | null> {
      const clerk = await clerkInstance();
      return toUser(clerk);
    },

    async getToken(): Promise<string | null> {
      try {
        const clerk = await clerkInstance();
        return (await clerk.session?.getToken()) ?? null;
      } catch {
        return null;
      }
    },

    async signIn({ email, password }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signIn = clerk.client?.signIn;
        if (!signIn) throw new AuthError("unknown", "Clerk client is not ready");

        const result = await signIn.create({ identifier: email, password });

        if (result.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId });
          return { status: "complete" };
        }
        throw new AuthError(
          "unknown",
          `Unsupported sign-in status: ${result.status ?? "unknown"}`,
        );
      });
    },

    async signUp({ email, password }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signUp = clerk.client?.signUp;
        if (!signUp) throw new AuthError("unknown", "Clerk client is not ready");

        const result = await signUp.create({ emailAddress: email, password });

        if (result.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId });
          return { status: "complete" };
        }

        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        return { status: "needsConfirmation" };
      });
    },

    async confirmSignUp({ code }): Promise<ConfirmSignUpResult> {
      return withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signUp = clerk.client?.signUp;
        if (!signUp) throw new AuthError("unknown", "Clerk client is not ready");

        const result = await signUp.attemptEmailAddressVerification({ code });

        if (result.status !== "complete") {
          throw new AuthError(
            "unknown",
            `Verification incomplete: ${result.status ?? "unknown"}`,
          );
        }

        // setActive establishes the session — Clerk's equivalent of Cognito's
        // post-confirmation autoSignIn, but it always succeeds in-session.
        await clerk.setActive({ session: result.createdSessionId });
        return { status: "complete", autoSignedIn: true };
      });
    },

    async resendCode(): Promise<void> {
      await withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signUp = clerk.client?.signUp;
        if (!signUp) throw new AuthError("unknown", "Clerk client is not ready");
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      });
    },

    async forgotPassword(email): Promise<ForgotPasswordResult> {
      return withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signIn = clerk.client?.signIn;
        if (!signIn) throw new AuthError("unknown", "Clerk client is not ready");

        await signIn.create({
          strategy: "reset_password_email_code",
          identifier: email,
        });
        return { status: "codeSent" };
      });
    },

    async resetPassword({ code, newPassword }): Promise<void> {
      await withAuthErrors(async () => {
        const clerk = await clerkInstance();
        const signIn = clerk.client?.signIn;
        if (!signIn) throw new AuthError("unknown", "Clerk client is not ready");

        const result = await signIn.attemptFirstFactor({
          strategy: "reset_password_email_code",
          code,
          password: newPassword,
        });

        if (result.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId });
          return;
        }
        if (result.status === "needs_new_password") {
          const reset = await signIn.resetPassword({ password: newPassword });
          if (reset.status === "complete") {
            await clerk.setActive({ session: reset.createdSessionId });
            return;
          }
        }
        throw new AuthError(
          "unknown",
          `Password reset incomplete: ${result.status ?? "unknown"}`,
        );
      });
    },

    async signOut(): Promise<void> {
      const clerk = await clerkInstance();
      await clerk.signOut();
    },

    onAuthChange(callback: (event: AuthChangeEvent) => void) {
      let disposed = false;
      let removeListener: (() => void) | undefined;
      let hadSession: boolean | null = null;

      void clerkInstance().then((clerk) => {
        if (disposed) return;
        hadSession = Boolean(clerk.session);
        removeListener = clerk.addListener(({ session }) => {
          const hasSession = Boolean(session);
          if (hadSession === hasSession) return;
          hadSession = hasSession;
          callback(hasSession ? { type: "signedIn" } : { type: "signedOut" });
        });
      });

      return () => {
        disposed = true;
        removeListener?.();
      };
    },
  };

  return client;
}
