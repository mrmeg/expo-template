import { useEffect, useState } from "react";
import {
  getAuthClient,
  getAuthProvider,
  getSocialAuthProviders,
  type SocialAuthProviderName,
} from "@/client/features/auth/provider";

export type AccountCapabilities = {
  /** An auth provider is configured; without one the account rows are hidden. */
  authEnabled: boolean;
  /** The provider can email a reset code to the signed-in address. */
  canResetPassword: boolean;
  /** The active `AuthClient` implements `deleteAccount`. */
  canDeleteAccount: boolean;
  /** Federated providers the env lists and the active provider can start. */
  socialProviders: SocialAuthProviderName[];
};

/**
 * What the Profile tab may offer for the current environment and session. Every
 * row that needs a backend flow is gated here, so a fork with auth off, or a
 * provider that lacks a flow, never shows a row that ends in a toast.
 */
export function useAccountCapabilities(email: string | undefined): AccountCapabilities {
  const authEnabled = getAuthProvider() !== null;
  const [canDeleteAccount, setCanDeleteAccount] = useState(false);

  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    getAuthClient()
      .then((client) => {
        if (!cancelled) setCanDeleteAccount(typeof client?.deleteAccount === "function");
      })
      .catch(() => {
        if (!cancelled) setCanDeleteAccount(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  return {
    authEnabled,
    canResetPassword: authEnabled && Boolean(email),
    canDeleteAccount: authEnabled && canDeleteAccount,
    socialProviders: authEnabled ? getSocialAuthProviders() : [],
  };
}
