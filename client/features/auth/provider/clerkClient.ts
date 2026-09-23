/**
 * Clerk implementation of `AuthClient`.
 *
 * Uses `getClerkInstance()` — Clerk's imperative singleton accessor — rather
 * than React hooks, so the store-driven architecture keeps working unchanged.
 * The singleton is built and loaded by the `ClerkProvider` the root layout
 * mounts while the native splash is up; `init()` waits for the provider to
 * report the load settled (`./clerkLoadSignal.ts`), with a timeout as the only
 * fallback, and never reads the instance before then.
 *
 * Flow mapping (email + password with emailed verification code, matching
 * the existing screens):
 *   signIn        → clerk.client.signIn.create({ identifier, password })
 *   signUp        → clerk.client.signUp.create({ emailAddress, password })
 *                   + prepareEmailAddressVerification({ strategy: "email_code" });
 *                   the contract's optional password is required here, so a
 *                   passwordless sign-up reports `unsupported`.
 *   confirmSignUp → signUp.attemptEmailAddressVerification; setActive on the
 *                   created session, so autoSignedIn is always true.
 *   forgot/reset  → signIn.create({ strategy: "reset_password_email_code" })
 *                   + attemptFirstFactor with code and new password.
 *
 * Chunk ownership (web): this module is the single async entry point for the
 * Clerk SDK. Nothing in the eager graph imports it — `provider/index.ts` and
 * `AuthProviderGate` both reach it through `await import("./clerkClient")` —
 * so `@clerk/clerk-expo` can be imported statically here and still ship as an
 * async chunk. That is deliberate and load-bearing: Metro hoists any module
 * two async chunks share into the eagerly `<script>`-loaded `__common` bundle,
 * so a second reference (a nested `await import("@clerk/clerk-expo")` here, or
 * a separate chunk importing the SDK) would put the whole ~280 kB Clerk
 * cluster back on every page load. Re-exporting `ClerkProviderBoundary` keeps
 * the React half in this same chunk for the same reason.
 */

import { getClerkInstance } from "@clerk/clerk-expo";
import { logDev } from "@/client/lib/devtools";
import type { User } from "../stores/authStore";
import { CLERK_INSTANCE_OPTIONS } from "./ClerkProviderBoundary";
import { clerkSettled, getClerkSettledStatus } from "./clerkLoadSignal";
import {
  AuthError,
  type AuthChangeEvent,
  type AuthClient,
  type AuthErrorCode,
  type AuthFlowResult,
  type ConfirmSignUpResult,
  type ForgotPasswordResult,
} from "./types";

export { default as ClerkProviderBoundary } from "./ClerkProviderBoundary";

type ClerkInstance = ReturnType<typeof getClerkInstance>;

/**
 * How long startup waits for `ClerkProvider` before continuing signed out. The
 * provider mounts with the splash, so this only elapses when Clerk cannot load
 * at all; a session it restores later still arrives through `onAuthChange`.
 */
export const CLERK_LOAD_TIMEOUT_MS = 10_000;

/**
 * The instance `ClerkProvider` loads. Native: the singleton, fetched with the
 * provider's own options so that even a call that beats the provider (only
 * possible after the timeout) builds it with the persistent token cache. Web:
 * `window.Clerk`, which is `undefined` until clerk-js has loaded.
 */
function currentClerk(): ClerkInstance | undefined {
  return getClerkInstance(CLERK_INSTANCE_OPTIONS) ?? undefined;
}

/** Resolves `true` once the provider settled, `false` if the timeout won. */
async function waitForProvider(): Promise<boolean> {
  if (getClerkSettledStatus()) return true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), CLERK_LOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([clerkSettled().then(() => true as const), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

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
  let initPromise: Promise<void> | null = null;

  async function loadClerk(): Promise<void> {
    // ClerkProvider owns loading; wait for it to settle so getCurrentUser and
    // getToken see the restored session instead of racing startup.
    const settled = await waitForProvider();
    if (!settled) {
      logDev(
        `ClerkProvider did not finish loading Clerk within ${CLERK_LOAD_TIMEOUT_MS / 1000}s; continuing unauthenticated`,
      );
    } else if (!currentClerk()?.loaded) {
      logDev("Clerk failed to load; continuing unauthenticated");
    }
  }

  /**
   * The Clerk instance once startup's wait is over. Re-read on every call
   * rather than cached: on web, `window.Clerk` can arrive after the timeout.
   */
  async function clerkInstance(): Promise<ClerkInstance | undefined> {
    if (!initPromise) initPromise = loadClerk();
    await initPromise;
    return currentClerk();
  }

  /** For the flows below: they cannot run without a Clerk instance. */
  async function requireClerk(): Promise<ClerkInstance> {
    const clerk = await clerkInstance();
    if (!clerk) throw new AuthError("unknown", "Clerk client is not ready");
    return clerk;
  }

  function toUser(clerk: ClerkInstance | undefined): User | null {
    const clerkUser = clerk?.user;
    if (!clerk || !clerkUser || !clerk.session) return null;
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
        return (await clerk?.session?.getToken()) ?? null;
      } catch {
        return null;
      }
    },

    async signIn({ email, password }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const clerk = await requireClerk();
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

    /**
     * Passwordless sign-in/sign-up and social sign-in are Cognito-only for now:
     * the template's apps are migrating off Clerk, so these stay `unsupported`
     * rather than growing a second implementation. `getSocialAuthProviders()`
     * keeps the social buttons hidden on the Clerk path; the passwordless
     * actions are not env-gated (the Cognito side depends on pool settings this
     * app can't read), so a Clerk deploy that offers them shows the normalized
     * message below instead of a generic failure.
     */
    async signInWithEmailCode(): Promise<AuthFlowResult> {
      throw new AuthError(
        "unsupported",
        "Email-code sign-in is not implemented for Clerk. Use password sign-in or switch EXPO_PUBLIC_AUTH_PROVIDER to cognito.",
      );
    },

    async confirmSignInCode(): Promise<{ status: "complete" }> {
      throw new AuthError(
        "unsupported",
        "Email-code sign-in is not implemented for Clerk. Use password sign-in or switch EXPO_PUBLIC_AUTH_PROVIDER to cognito.",
      );
    },

    async signInWithProvider(): Promise<void> {
      throw new AuthError(
        "unsupported",
        "Social sign-in is not implemented for Clerk. Use password sign-in or switch EXPO_PUBLIC_AUTH_PROVIDER to cognito.",
      );
    },

    async signUp({ email, password }): Promise<AuthFlowResult> {
      // Password-optional sign-up is Cognito-only, for the reason above. Fail
      // before touching the SDK so a caller can offer the password path instead.
      if (password === undefined) {
        throw new AuthError(
          "unsupported",
          "Signing up without a password is not implemented for Clerk. Provide a password or switch EXPO_PUBLIC_AUTH_PROVIDER to cognito.",
        );
      }

      return withAuthErrors(async () => {
        const clerk = await requireClerk();
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
        const clerk = await requireClerk();
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
        const clerk = await requireClerk();
        const signUp = clerk.client?.signUp;
        if (!signUp) throw new AuthError("unknown", "Clerk client is not ready");
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      });
    },

    async forgotPassword(email): Promise<ForgotPasswordResult> {
      return withAuthErrors(async () => {
        const clerk = await requireClerk();
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
        const clerk = await requireClerk();
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
      await clerk?.signOut();
    },

    onAuthChange(callback: (event: AuthChangeEvent) => void) {
      let disposed = false;
      let removeListener: (() => void) | undefined;

      /** Report session transitions relative to `hadSession`. */
      const attach = (clerk: ClerkInstance, hadSessionAtStart: boolean) => {
        let hadSession = hadSessionAtStart;
        removeListener = clerk.addListener(({ session }) => {
          const hasSession = Boolean(session);
          if (hadSession === hasSession) return;
          hadSession = hasSession;
          callback(hasSession ? { type: "signedIn" } : { type: "signedOut" });
        });
      };

      void clerkInstance().then(async (clerk) => {
        if (disposed) return;
        if (clerk && getClerkSettledStatus()) {
          attach(clerk, Boolean(clerk.session));
          return;
        }

        // Startup gave up waiting (timeout), so the store now shows the viewer
        // signed out. Attach once the provider does settle: a session Clerk
        // restores then is reported as a sign-in rather than taken as the
        // baseline.
        await clerkSettled();
        const late = disposed ? undefined : currentClerk();
        if (late) attach(late, false);
      });

      return () => {
        disposed = true;
        removeListener?.();
      };
    },
  };

  return client;
}
