import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";
import { initAuth, useAuthStore } from "@/client/features/auth/stores/authStore";
import { logDev } from "@/client/lib/devtools";
import { isAuthEnabled } from "./isAuthEnabled";

/**
 * Root app startup gate.
 *
 * Centralizes the readiness checks the shell needs before it can route:
 * - i18n initialization (passed in — already owned by the root layout)
 * - fonts / resources (passed in — already owned by the root layout)
 * - onboarding state has been loaded from persistence
 * - auth change listener is registered and the initial auth state has resolved
 *   (only when auth is configured; otherwise we short-circuit). With Clerk this
 *   waits for the `ClerkProvider` that `StartupGate` mounts under the splash.
 *
 * Doing this once here prevents the historical foot-gun where auth bootstrap
 * only ran when the auth-demo route mounted, so account surfaces were built
 * on an undefined shell contract.
 *
 * `ready` latches: every input only ever flips to true, so a later session
 * refresh (sign-in, sign-out, a provider event) never sends the native tree
 * back behind the splash. Auth surfaces show those as `AuthGate`'s spinner.
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
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(!authEnabled);

  // Load onboarding from persistence once, then mark as loaded so downstream
  // checks can trust `hasSeenOnboarding`. `loadOnboarding()` resolves only after
  // the persisted value has been read (AsyncStorage on native, localStorage on
  // web), so awaiting it is what keeps the native splash up until the real flag
  // is known instead of flashing the default-false gate.
  useEffect(() => {
    let cancelled = false;
    useOnboardingStore.getState().loadOnboarding().finally(() => {
      if (!cancelled) setOnboardingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Register the change listener and resolve the initial auth state exactly
  // once. When auth is disabled the flag is set synchronously above.
  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
      } catch (error) {
        logDev("Auth bootstrap failed; continuing signed out:", error);
      }
      // Forced so the startup read can never be throttled away, and awaited
      // through any read already in flight: once it settles the store is out
      // of "loading", which is what keeps a signed-in user from flashing the
      // signed-out shell. It never rejects — errors land in "unauthenticated".
      await useAuthStore.getState().initialize({ force: true });
      if (!cancelled) setAuthBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  const ready = fontsLoaded && i18nReady && onboardingLoaded && authBootstrapped;

  return { ready, authEnabled };
}
