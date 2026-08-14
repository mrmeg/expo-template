/**
 * Feature-wide barrel, kept for discoverability. Note that it re-exports the
 * auth UI statically: importing a component through *this* module re-attaches
 * the auth screen + forms to the importer's chunk and undoes the split point
 * documented in ./components/index.ts. Screens should import state/hooks from
 * here (or their own modules) and reach the components through
 * `import("@/client/features/auth/components")`.
 */

export { AuthScreen } from "./components/AuthScreen";
export { AuthWrapper } from "./components/AuthWrapper";
export { SignInForm } from "./components/SignInForm";
export { SignUpForm } from "./components/SignUpForm";
export { ForgotPasswordForm } from "./components/ForgotPasswordForm";
export { ResetPasswordForm } from "./components/ResetPasswordForm";
export { VerifyEmailForm } from "./components/VerifyEmailForm";
export { useAuth } from "./hooks/useAuth";
export { useAuthStore, initAuth } from "./stores/authStore";
export type { User, AuthState } from "./stores/authStore";
export {
  getAuthClient,
  getAuthProvider,
  AuthError,
  isAuthError,
} from "./provider";
export type {
  AuthClient,
  AuthProviderName,
  AuthErrorCode,
  AuthFlowResult,
  ConfirmSignUpResult,
  ForgotPasswordResult,
} from "./provider";
