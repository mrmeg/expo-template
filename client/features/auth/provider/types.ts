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
