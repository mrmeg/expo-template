import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";
import { initAuth } from "@/client/features/auth/stores/authStore";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { isAuthEnabled } from "./isAuthEnabled";

/**
 * Root app startup gate.
 *
 * Centralizes the readiness checks the shell needs before it can route:
 * - i18n initialization (passed in — already owned by the root layout)
 * - fonts / resources (passed in — already owned by the root layout)
 * - onboarding state has been loaded from persistence
 * - auth Hub listener is registered and the initial auth state has resolved
 *   (only when auth is configured; otherwise we short-circuit)
 *
 * Doing this once here prevents the historical foot-gun where auth bootstrap
 * only ran when the auth-demo route mounted, so account surfaces were built
 * on an undefined shell contract.
 */
export interface StartupInputs {
  fontsLoaded: boolean;
  i18nReady: boolean;
}

export interface StartupResult {
  ready: boolean;
  authEnabled: boolean;
}

export function useAppStartup({ fontsLoaded, i18nReady }: StartupInputs): StartupResult {
  const authEnabled = isAuthEnabled();
  const authState = useAuthStore((s) => s.state);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(!authEnabled);

  // Load onboarding from persistence once, then mark as loaded so downstream
  // checks can trust `hasSeenOnboarding`. The store's internal loader is
  // fire-and-forget, so we wrap it with a micro-task to surface completion.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useOnboardingStore.getState().loadOnboarding()).finally(() => {
      if (!cancelled) setOnboardingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Register the Hub listener and resolve initial auth state exactly once.
  // When auth is disabled the flag is set synchronously above.
  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        await useAuthStore.getState().initialize();
      } catch {
        // initialize() already funnels errors into `unauthenticated`
      }
      if (!cancelled) setAuthBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  const ready =
    fontsLoaded &&
    i18nReady &&
    onboardingLoaded &&
    authBootstrapped &&
    // When auth is enabled, also wait for the initial state to resolve out
    // of "loading". This prevents a flash of the unauthenticated shell for
    // users who have a valid session.
    (!authEnabled || authState !== "loading");

  return { ready, authEnabled };
}
