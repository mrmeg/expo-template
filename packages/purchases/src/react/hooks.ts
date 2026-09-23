/**
 * Entitlement facts and the gate call for components. Lifted from Mindmap
 * `client/features/pro/usePro.ts`.
 */
import { useCallback } from "react";
import { useStore } from "zustand";

import { resolveEntitlement, type EntitlementResolution, type SdkStatus } from "../entitlementStore";
import type { CustomerState, PaywallOutcome, PresentPaywallOptions, RestoreOutcome } from "../types";
import { usePurchasesContext } from "./context";

export interface EntitlementView extends EntitlementResolution {
  /** The persisted snapshot was read; hold the splash screen until this is true. */
  hydrated: boolean;
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
  const { client, store } = usePurchasesContext();
  const customer = useStore(store, (state) => state.customer);
  const serverUntil = useStore(store, (state) => state.serverUntil);
  const snapshot = useStore(store, (state) => state.snapshot);
  const devOverride = useStore(store, (state) => state.devOverride);
  const hydrated = useStore(store, (state) => state.hydrated);
  const sdkStatus = useStore(store, (state) => state.sdkStatus);

  const target = entitlement !== undefined && entitlement !== client.entitlement ? entitlement : undefined;
  const resolution = resolveEntitlement({ customer, serverUntil, snapshot, devOverride }, Date.now(), target);

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
