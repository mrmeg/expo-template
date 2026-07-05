/**
 * Single source of truth for whether an auth provider is wired up.
 *
 * Delegates to `getAuthProvider()` (client/features/auth/provider) so the
 * startup gate, per-route auth policy, and provider selection can't drift.
 *
 * When false, the template is fully explorable without a live Cognito or
 * Clerk environment (see Agent/Docs/USER_FLOWS.md). When true, protected
 * surfaces gate on `authStore.state === "authenticated"`.
 */
import { getAuthProvider } from "@/client/features/auth/provider";

export function isAuthEnabled(): boolean {
  return getAuthProvider() !== null;
}
