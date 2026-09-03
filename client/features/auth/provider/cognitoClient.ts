/**
 * Cognito (AWS Amplify) implementation of `AuthClient`.
 *
 * Owns everything Amplify-specific: `Amplify.configure` (user pool plus the
 * optional managed-login oauth block), the Hub listener, the
 * post-confirmation `autoSignIn` dance, and mapping Amplify result shapes /
 * exception names onto the normalized contract in `types.ts`.
 *
 * The SDK is never imported statically here: every access goes through
 * `loadSdk()`, whose default is the one `import("./cognitoSdk")` below, so
 * Amplify loads only when Cognito is the active provider and only ever from
 * that single split point — on web, Metro hoists any module shared by two async
 * chunks into the eager `__common` bundle, so importing `aws-amplify`,
 * `aws-amplify/utils`, and `aws-amplify/auth` directly would put the shared
 * Amplify internals on every page load. See `cognitoSdk.ts` for the full
 * rationale.
 *
 * Sign-in methods, and what each needs on the AWS side:
 *   signIn              → password (`USER_SRP_AUTH`), always available.
 *   signInWithEmailCode → choice-based `USER_AUTH` flow with the `EMAIL_OTP`
 *                         factor: an Essentials-tier pool whose sign-in policy
 *                         allows EMAIL_OTP and a client with ALLOW_USER_AUTH.
 *   signInWithProvider  → Managed Login domain (`EXPO_PUBLIC_COGNITO_DOMAIN`)
 *                         plus a registered Google/Apple identity provider.
 *                         Fails closed with `AuthError("unsupported")` while
 *                         the domain is unset. On native it also needs the
 *                         autolinked `@aws-amplify/rtn-web-browser` module,
 *                         i.e. a dev build — not Expo Go.
 * `scripts/create-cognito-pool.sh` provisions all three.
 */

import { Platform } from "react-native";
import { logDev } from "@/client/lib/devtools";
import { getAppScheme } from "@/client/lib/identity";
import type { User } from "../stores/authStore";
import {
  AuthError,
  type AuthChangeEvent,
  type AuthClient,
  type AuthErrorCode,
  type AuthFlowResult,
  type ConfirmSignUpResult,
  type ForgotPasswordResult,
  type SocialAuthProviderName,
} from "./types";

// Type-only, so it is erased by the transform and creates no chunk of its own.
type AmplifyAuthModule = typeof import("aws-amplify/auth");

/**
 * How this module reaches the Amplify SDK. The default is the single dynamic
 * import that owns the Amplify chunk; tests substitute a fake module because
 * Jest can't execute a dynamic import (see ./__tests__/cognitoClient.test.ts).
 * Nothing in the app passes a loader — do not add a second call site.
 */
export type CognitoSdkLoader = () => Promise<typeof import("./cognitoSdk")>;

const loadCognitoSdk: CognitoSdkLoader = () => import("./cognitoSdk");

/** Amplify's `AuthProvider` union is capitalized; our contract is not. */
const AMPLIFY_PROVIDER: Record<SocialAuthProviderName, "Google" | "Apple"> = {
  google: "Google",
  apple: "Apple",
};

const OAUTH_SCOPES = ["openid", "email", "profile"];

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

/**
 * The Managed Login domain, or null when social sign-in is not configured.
 * Operators paste this out of the console, so a pasted `https://…/` is
 * normalized to the bare host Amplify expects.
 */
function getCognitoDomain(): string | null {
  const raw = process.env.EXPO_PUBLIC_COGNITO_DOMAIN;
  const domain = (raw ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return domain === "" ? null : domain;
}

/**
 * Where Cognito sends the browser back to. Native uses the app's deep-link
 * scheme; web uses the page origin, which does not exist while the route is
 * server-rendered — no origin means no oauth block, and `signInWithProvider`
 * only runs on the client anyway.
 */
function getRedirectUrls(): string[] {
  if (Platform.OS === "web") {
    const origin = typeof window === "undefined" ? "" : (window.location?.origin ?? "");
    return origin === "" ? [] : [origin];
  }
  return [`${getAppScheme()}://`];
}

export function createCognitoAuthClient(
  loadSdk: CognitoSdkLoader = loadCognitoSdk,
): AuthClient {
  let initPromise: Promise<void> | null = null;
  const listeners = new Set<(event: AuthChangeEvent) => void>();

  const emit = (event: AuthChangeEvent) => {
    for (const listener of listeners) listener(event);
  };

  async function configure(): Promise<void> {
    // Invariant: both vars are set. `getAuthClient` only constructs this client
    // when `getAuthProvider()` selected "cognito", which requires both (see
    // ./index.ts) — the missing-env case fails closed there, not here.
    const userPoolId = process.env.EXPO_PUBLIC_USER_POOL_ID ?? "";
    const userPoolClientId = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID ?? "";

    // Social sign-in is opt-in: without a Managed Login domain (or, on web,
    // without a page origin to come back to) the oauth block is omitted
    // entirely and `signInWithProvider` reports "unsupported".
    const domain = getCognitoDomain();
    const redirectUrls = domain ? getRedirectUrls() : [];
    const loginWith =
      domain && redirectUrls.length > 0
        ? {
          loginWith: {
            oauth: {
              domain,
              scopes: OAUTH_SCOPES,
              responseType: "code" as const,
              redirectSignIn: redirectUrls,
              redirectSignOut: redirectUrls,
            },
          },
        }
        : null;

    const { Amplify, Hub } = await loadSdk();
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          ...loginWith,
        },
      },
    });

    // The Hub listener lives for the process; consumers attach and detach
    // via onAuthChange without touching the underlying subscription.
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
    const { amplifyAuth } = await loadSdk();
    return amplifyAuth;
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

    async signInWithEmailCode({ email }): Promise<AuthFlowResult> {
      return withAuthErrors(async () => {
        const { signIn } = await auth();
        // Choice-based auth: USER_AUTH lets the pool offer several first
        // factors and `preferredChallenge` picks the emailed code, so no
        // password is collected and no custom Lambda is involved.
        const result = await signIn({
          username: email,
          options: { authFlowType: "USER_AUTH", preferredChallenge: "EMAIL_OTP" },
        });
        if (result.isSignedIn) return { status: "complete" };
        if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE") {
          return { status: "needsConfirmation" };
        }
        throw new AuthError(
          "unknown",
          `Unsupported email-code sign-in step: ${result.nextStep?.signInStep ?? "none"}`,
        );
      });
    },

    async confirmSignInCode({ code }): Promise<{ status: "complete" }> {
      return withAuthErrors(async () => {
        const { confirmSignIn } = await auth();
        const result = await confirmSignIn({ challengeResponse: code });
        if (result.isSignedIn) return { status: "complete" };

        // Cognito re-issues the same challenge on a wrong code instead of
        // throwing; anything else means the flow moved somewhere we don't
        // drive (and a lost in-memory challenge rejects above).
        const step = result.nextStep?.signInStep;
        throw new AuthError(
          step === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE" ? "codeMismatch" : "unknown",
          step === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE"
            ? "That code didn't match. Request a new one and try again."
            : `Unsupported sign-in step: ${step ?? "none"}`,
        );
      });
    },

    async signInWithProvider(provider: SocialAuthProviderName): Promise<void> {
      if (!getCognitoDomain()) {
        throw new AuthError(
          "unsupported",
          "Social sign-in needs a Cognito Managed Login domain. Set EXPO_PUBLIC_COGNITO_DOMAIN and register the identity provider on the user pool.",
        );
      }

      await withAuthErrors(async () => {
        const { signInWithRedirect } = await auth();
        // Resolves once the browser has the redirect; the session arrives via
        // the Hub listener above (`signInWithRedirect` → `signedIn`).
        await signInWithRedirect({ provider: AMPLIFY_PROVIDER[provider] });
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
