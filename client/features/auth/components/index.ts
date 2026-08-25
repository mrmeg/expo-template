/**
 * Auth UI barrel — and, on web, the single code-splitting boundary for the
 * whole auth component graph (~57 kB raw).
 *
 * Metro hoists any module reachable from two or more async chunks into the
 * eagerly `<script>`-loaded `__common` bundle, so a module only stays lazy
 * behind exactly one split point. Every dynamic import of these components
 * therefore targets this barrel by the same specifier
 * (`@/client/features/auth/components`) — `AuthGate`, the `auth-demo` route,
 * and the showcase gallery all do — which keeps the screen, the five forms and
 * their shared `AuthTextField` in one lazy chunk instead of on the first-render
 * download path of every route. Same pattern, same reason as
 * `../provider/AuthProviderGate.tsx`.
 *
 * Import a component from this barrel with `import()` (not a static `import`)
 * when you add a new consumer; a static import re-attaches the graph to that
 * consumer's chunk and, with a second consumer, back into `__common`.
 *
 * `stores/authStore`, `hooks/useAuth` and `provider/*` are deliberately not
 * re-exported here: they are small, hot, and used by screens that must not pay
 * a chunk fetch, so consumers deep-import those modules directly. There is no
 * feature-wide `@/client/features/auth` barrel for the same reason — one would
 * pull this component graph into every importer's chunk.
 */

export { AuthScreen } from "./AuthScreen";
export { AuthWrapper } from "./AuthWrapper";
export { SignInForm } from "./SignInForm";
export { SignUpForm } from "./SignUpForm";
export { VerifyEmailForm } from "./VerifyEmailForm";
export { ForgotPasswordForm } from "./ForgotPasswordForm";
export { ResetPasswordForm } from "./ResetPasswordForm";

export type { SignInFormProps } from "./SignInForm";
export type { SignUpFormProps } from "./SignUpForm";
export type { VerifyEmailFormProps } from "./VerifyEmailForm";
export type { ForgotPasswordFormProps } from "./ForgotPasswordForm";
export type { ResetPasswordFormProps } from "./ResetPasswordForm";
