/**
 * Entitlement facts and the gate call for components. Lifted from Mindmap
 * `client/features/pro/usePro.ts`.
 */
import { useCallback } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { resolveEntitlement, type EntitlementResolution, type SdkStatus } from "../entitlementStore";
import type { CustomerState, PaywallOutcome, PresentPaywallOptions, RestoreOutcome } from "../types";
import { usePurchasesContext } from "./context";

export interface EntitlementView extends EntitlementResolution {
  /** The persisted snapshot for this user was read. */
  hydrated: boolean;
  /**
   * The verdict is worth acting on: the store is scoped to the current user,
   * hydrated, and either a source has reported (device, server, snapshot), the
   * SDK is unavailable, or there is no user. Hold the splash screen and any
   * automatic paywall until this is true.
   */
  settled: boolean;
  /** A public SDK key exists for this platform. */
  isConfigured: boolean;
  /** The SDK configured successfully and purchases can be made. */
  isReady: boolean;
  sdkStatus: SdkStatus;
  customer: CustomerState | null;
  restore: () => Promise<RestoreOutcome>;
  presentPaywall: (options?: PresentPaywallOptions) => Promise<PaywallOutcome>;
  presentPaywallIfNeeded: (options?: PresentPaywallOptions) => Promise<PaywallOutcome>;
}

/**
 * Access facts for the configured entitlement, or for `entitlement` when it
 * names another one (checked against the device's active list only).
 */
export function useEntitlement(entitlement?: string): EntitlementView {
  const { client, store, userId } = usePurchasesContext();
  const customer = useStore(store, (state) => state.customer);
  const hydrated = useStore(store, (state) => state.hydrated);
  const sdkStatus = useStore(store, (state) => state.sdkStatus);
  const settled = useStore(
    store,
    (state) =>
      state.hydrated &&
      state.userId === userId &&
      (userId === null ||
        state.deviceReported ||
        state.serverUntil !== null ||
        state.snapshot !== null ||
        state.sdkStatus === "unavailable"),
  );

  const target = entitlement !== undefined && entitlement !== client.entitlement ? entitlement : undefined;
  // The clock is read inside the selector, not in render, and the result is
  // shallow-compared (three primitives) so a fresh object never loops.
  const resolution = useStore(
    store,
    useShallow((state) => resolveEntitlement(state, Date.now(), target)),
  );

  const restore = useCallback(() => client.restore(), [client]);
  const presentPaywall = useCallback(
    (options?: PresentPaywallOptions) => client.presentPaywall(options),
    [client],
  );
  const presentPaywallIfNeeded = useCallback(
    (options?: PresentPaywallOptions) => client.presentPaywallIfNeeded(options),
    [client],
  );

  return {
    ...resolution,
    hydrated,
    settled,
    isConfigured: client.isConfigured(),
    isReady: sdkStatus === "ready",
    sdkStatus,
    customer,
    restore,
    presentPaywall,
    presentPaywallIfNeeded,
  };
}

/**
 * The one call gate points make: returns true when the action may proceed and
 * otherwise reports `feature` to the provider's `onBlocked` (which opens the
 * paywall) and returns false.
 */
export function useRequireEntitlement(feature: string): () => boolean {
  const { onBlocked } = usePurchasesContext();
  const { isEntitled } = useEntitlement();
  return useCallback(() => {
    if (isEntitled) return true;
    onBlocked?.(feature);
    return false;
  }, [feature, isEntitled, onBlocked]);
}
