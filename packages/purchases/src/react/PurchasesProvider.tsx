/**
 * Boots RevenueCat for the signed-in user and keeps the entitlement store
 * current. Lifted from Mindmap `client/features/pro/PurchasesProvider.tsx`.
 *
 * Nothing touches the SDK or persists without a `userId`: an anonymous visitor
 * must not become an anonymous RevenueCat customer. With a user:
 *  - the store is rescoped to that user (previous sources dropped) and its
 *    snapshot read (`hydrate`);
 *  - the SDK is configured once (`sdkStatus` becomes `ready` or `unavailable`),
 *    `logIn(userId)` applied — even when null, so `deviceReported` marks the
 *    attempt — and only then the customer-info listener attached;
 *  - `serverUntil` (the app's webhook-synced expiry) is mirrored into the store
 *    once `serverPending` is false.
 * When `userId` becomes null the SDK returns to anonymous and the store is
 * cleared, including the persisted snapshot. Mount it inside the auth boundary:
 * while `userId` is null every gate treats the visitor as settled and not
 * entitled.
 */
import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

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
      // logOut awaits a configure in flight and is serialised behind any logIn,
      // so a sign-out during configure(userId) still returns the SDK to anonymous.
      if (client.isConfigured()) void client.logOut();
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
      // Identify first, then listen: the SDK emits the anonymous customer after
      // the previous user's logOut, and that must not be applied under this user.
      const customer = await client.logIn(userId);
      if (cancelled) return;
      store.getState().applyCustomerState(customer);
      unsubscribe = client.subscribe((update) => {
        if (!cancelled) store.getState().applyCustomerState(update);
      });
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
    // `client` is a dep only so this re-applies after the scope effect above
    // re-ran (and reset the store) for a new client instance.
  }, [client, store, serverUntil, serverPending, userId]);

  // The app usually passes an inline `onBlocked`; route it through a ref so the
  // context value (and every gate) does not re-render on each provider render.
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);
  const stableOnBlocked = useCallback((feature?: string) => onBlockedRef.current?.(feature), []);

  const value = useMemo<PurchasesContextValue>(
    () => ({ client, store, userId, onBlocked: stableOnBlocked }),
    [client, store, userId, stableOnBlocked],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}
