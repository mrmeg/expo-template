/**
 * Provider-agnostic auth client contract.
 *
 * Mirrors the server's pluggable `TokenVerifier` (server/api/shared/auth.ts):
 * screens, hooks, and the auth store only ever see this interface plus the
 * normalized result/error shapes below. Cognito- and Clerk-specific SDK
 * shapes (Amplify `nextStep` objects, Clerk `status` strings, error names)
 * stay inside the respective client implementations.
 */

import type { User } from "../stores/authStore";

export type AuthProviderName = "cognito" | "clerk";

/**
 * Federated identity providers the template can start a redirect sign-in with.
 * Kept deliberately narrow: each name needs an identity provider registered on
 * the provider side (see `scripts/create-cognito-pool.sh`).
 */
export type SocialAuthProviderName = "google" | "apple";

/** Sign-in / sign-up either finish or require an emailed confirmation code. */
export interface AuthFlowResult {
  status: "complete" | "needsConfirmation";
}

export interface ConfirmSignUpResult {
  status: "complete";
  /** True when the provider established a session during confirmation. */
  autoSignedIn: boolean;
}

export interface ForgotPasswordResult {
  /** `codeSent` → show the code + new-password form; `done` → nothing to enter. */
  status: "codeSent" | "done";
}

/**
 * Normalized auth error codes. Screens map these to friendly copy; anything
 * a provider can't classify surfaces as `unknown` with the SDK's message.
 */
export type AuthErrorCode =
  | "userNotConfirmed"
  | "incorrectCredentials"
  | "userNotFound"
  | "userExists"
  | "invalidPassword"
  | "codeMismatch"
  | "codeExpired"
  | "limitExceeded"
  /** The active provider (or its env config) can't run this flow at all. */
  | "unsupported"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/** Session-level changes pushed from the provider SDK to the auth store. */
export type AuthChangeEvent =
  | { type: "signedIn" }
  | { type: "signedOut" }
  | { type: "sessionExpired" };

export interface AuthClient {
  /**
   * One-time async setup (SDK configuration, waiting for the provider to
   * hydrate its session). Idempotent; callers may invoke it repeatedly.
   */
  init(): Promise<void>;

  /** Resolve the current user, or null when no session exists. */
  getCurrentUser(): Promise<User | null>;

  /** Bearer token for API requests, or null when unauthenticated. */
  getToken(): Promise<string | null>;

  signIn(params: { email: string; password: string }): Promise<AuthFlowResult>;

  /**
   * Start a passwordless sign-in: the provider emails a one-time code.
   * `needsConfirmation` means "code sent, collect it and call
   * `confirmSignInCode`"; `complete` means the provider already had a session.
   */
  signInWithEmailCode(params: { email: string }): Promise<AuthFlowResult>;

  /**
   * Finish the in-flight email-code sign-in. No email parameter: the pending
   * challenge lives in the provider SDK, so this continues whatever
   * `signInWithEmailCode` started in this process. If that state is gone (app
   * restart), it rejects and the caller requests a fresh code.
   */
  confirmSignInCode(params: { code: string }): Promise<{ status: "complete" }>;

  /**
   * Launch a federated sign-in redirect. Resolves once the redirect is handed
   * to the browser — the session itself arrives later through `onAuthChange`.
   * Rejects with `AuthError("unsupported")` when the provider isn't configured
   * for federated sign-in.
   */
  signInWithProvider(provider: SocialAuthProviderName): Promise<void>;

  signUp(params: { email: string; password: string }): Promise<AuthFlowResult>;
  confirmSignUp(params: { email: string; code: string }): Promise<ConfirmSignUpResult>;
  resendCode(email: string): Promise<void>;
  forgotPassword(email: string): Promise<ForgotPasswordResult>;
  resetPassword(params: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<void>;
  signOut(): Promise<void>;

  /**
   * Subscribe to session changes originating in the SDK (token refresh
   * failures, sign-out in another tab, OAuth redirects). Returns an
   * unsubscribe function.
   */
  onAuthChange(callback: (event: AuthChangeEvent) => void): () => void;
}
