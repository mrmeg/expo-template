/**
 * Boots RevenueCat for the signed-in user and keeps the entitlement store
 * current. Lifted from Mindmap `client/features/pro/PurchasesProvider.tsx`.
 *
 * Nothing touches the SDK or persists without a `userId`: an anonymous visitor
 * must not become an anonymous RevenueCat customer. With a user:
 *  - the store is rescoped to that user (previous sources dropped) and its
 *    snapshot read (`hydrate`);
 *  - the SDK is configured once (`sdkStatus` becomes `ready` or `unavailable`),
 *    the customer-info listener attached, and `logIn(userId)` applied — the
 *    result is applied even when null so `deviceReported` marks the attempt;
 *  - `serverUntil` (the app's webhook-synced expiry) is mirrored into the store
 *    once `serverPending` is false.
 * When `userId` becomes null the SDK returns to anonymous and the store is
 * cleared, including the persisted snapshot. Mount it inside the auth boundary:
 * while `userId` is null every gate treats the visitor as settled and not
 * entitled.
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
  /**
   * Expiry the app's backend recorded from the webhook for `userId` (ms since
   * epoch), or null when it has none. Omit when the app has no server source.
   */
  serverUntil?: number | null;
  /**
   * True while the app is still loading `serverUntil` for this `userId`. The
   * store then keeps `serverReported` false, so gates do not settle on a stale
   * or missing server value. Pass it whenever your entitlement query is loading
   * or still holds the previous user's record.
   */
  serverPending?: boolean;
  /** Receives the blocked feature from `useRequireEntitlement` / `PaywallGate`. */
  onBlocked?: (feature?: string) => void;
  children: ReactNode;
}

export function PurchasesProvider({
  client,
  store,
  userId,
  serverUntil = null,
  serverPending = false,
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
      if (!cancelled) store.getState().applyCustomerState(customer);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [client, store, userId]);

  // Runs after the scope effect above (declaration order), so a user switch
  // re-applies the app's `serverUntil` into the freshly rescoped store.
  useEffect(() => {
    if (!userId || serverPending) return;
    store.getState().applyServerEntitlement(serverUntil ?? null);
  }, [store, serverUntil, serverPending, userId]);

  const value = useMemo<PurchasesContextValue>(
    () => ({ client, store, userId, onBlocked }),
    [client, store, userId, onBlocked],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}
