/**
 * Single source of truth for whether the Cognito auth shell is wired up.
 *
 * Mirrors the env-var predicate in `client/features/auth/config.ts` so the
 * startup gate and per-route auth policy can't drift.
 *
 * When false, the template is fully explorable without a live Cognito
 * environment (see Agent/Docs/USER_FLOWS.md). When true, protected surfaces
 * gate on `authStore.state === "authenticated"`.
 */
export function isAuthEnabled(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_USER_POOL_ID &&
      process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
  );
}
