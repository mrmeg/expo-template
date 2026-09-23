/**
 * Boots RevenueCat for the signed-in user and keeps the entitlement store
 * current. Lifted from Mindmap `client/features/pro/PurchasesProvider.tsx`.
 *
 * Every effect is inert without a `userId`: an anonymous visitor must not
 * become an anonymous RevenueCat customer. With a user:
 *  - the store is scoped to that user and its snapshot read (`hydrate`);
 *  - the SDK is configured once (`sdkStatus` becomes `ready` or `unavailable`),
 *    the customer-info listener attached, and `logIn(userId)` applied;
 *  - `serverUntil` (the app's webhook-synced expiry) is mirrored into the store.
 * When `userId` becomes null the SDK returns to anonymous and the store is
 * cleared, including the persisted snapshot.
 */
import React, { useEffect, useMemo, type ReactNode } from "react";

import type { EntitlementStore } from "../entitlementStore";
import type { PurchasesClient } from "../types";
import { PurchasesContext, type PurchasesContextValue } from "./context";

export interface PurchasesProviderProps {
  client: PurchasesClient;
  store: EntitlementStore;
  /** The app's auth subject; RevenueCat's `app_user_id`. Null while signed out. */
  userId: string | null;
  /** Expiry the app's backend recorded from the webhook (ms since epoch), or null. */
  serverUntil?: number | null;
  /** Receives the blocked feature from `useRequireEntitlement` / `PaywallGate`. */
  onBlocked?: (feature?: string) => void;
  children: ReactNode;
}

export function PurchasesProvider({
  client,
  store,
  userId,
  serverUntil = null,
  onBlocked,
  children,
}: PurchasesProviderProps) {
  useEffect(() => {
    const state = store.getState();
    if (!userId) {
      void state.clear();
      if (client.isReady()) void client.logOut();
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void state.hydrate(userId);

    void (async () => {
      if (!client.isConfigured()) {
        store.getState().setSdkStatus("unavailable");
        return;
      }
      const ready = await client.configure(userId);
      if (cancelled) return;
      store.getState().setSdkStatus(ready ? "ready" : "unavailable");
      if (!ready) return;
      unsubscribe = client.subscribe((customer) => {
        if (!cancelled) store.getState().applyCustomerState(customer);
      });
      const customer = await client.logIn(userId);
      if (!cancelled && customer) store.getState().applyCustomerState(customer);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [client, store, userId]);

  useEffect(() => {
    store.getState().applyServerEntitlement(serverUntil ?? null);
  }, [store, serverUntil]);

  const value = useMemo<PurchasesContextValue>(() => ({ client, store, onBlocked }), [client, store, onBlocked]);

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}
