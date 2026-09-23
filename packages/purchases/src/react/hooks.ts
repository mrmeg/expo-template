/**
 * Entitlement facts and the gate call for components. Lifted from Mindmap
 * `client/features/pro/usePro.ts`.
 */
import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  resolveEntitlement,
  type EntitlementResolution,
  type EntitlementState,
  type SdkStatus,
} from "../entitlementStore";
import type { CustomerState, PaywallOutcome, PresentPaywallOptions, RestoreOutcome } from "../types";
import { usePurchasesContext } from "./context";

export interface EntitlementView extends EntitlementResolution {
  /** The persisted snapshot for this user was read. */
  hydrated: boolean;
  /**
   * The verdict is worth acting on: the store is scoped to the current user,
   * hydrated, and either the device reported (a state or its absence), a
   * snapshot exists, the server granted, the SDK is unavailable and the server
   * has reported, or there is no user. Hold the splash screen and any automatic
   * paywall until this is true.
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

export function isSettled(state: EntitlementState, userId: string | null): boolean {
  if (!state.hydrated || state.userId !== userId) return false;
  if (userId === null) return true;
  return (
    state.deviceReported ||
    state.snapshot !== null ||
    state.serverUntil !== null ||
    (state.sdkStatus === "unavailable" && state.serverReported)
  );
}

const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Access facts for the configured entitlement, or for `entitlement` when it
 * names another one (checked against the device's active list only).
 */
export function useEntitlement(entitlement?: string): EntitlementView {
  const { client, store, userId } = usePurchasesContext();
  const target = entitlement !== undefined && entitlement !== client.entitlement ? entitlement : undefined;

  // One subscription; the clock is read inside the selector, not in render, and
  // the result is shallow-compared (primitives plus the customer reference) so a
  // fresh object never loops.
  const view = useStore(
    store,
    useShallow((state) => {
      const resolution = resolveEntitlement(state, Date.now(), target);
      return {
        isEntitled: resolution.isEntitled,
        until: resolution.until,
        source: resolution.source,
        hydrated: state.hydrated,
        settled: isSettled(state, userId),
        sdkStatus: state.sdkStatus,
        customer: state.customer,
      };
    }),
  );

  // A time-based grant (server expiry, snapshot) can lapse while the screen is
  // idle; re-render right after `until` so the verdict flips without a store
  // update.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!view.isEntitled || view.until === null) return;
    const delay = Math.min(Math.max(view.until - Date.now(), 0) + 1, MAX_TIMEOUT_MS);
    const id = setTimeout(() => setTick((tick) => tick + 1), delay);
    return () => clearTimeout(id);
  }, [view.isEntitled, view.until]);

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
    ...view,
    isConfigured: client.isConfigured(),
    isReady: view.sdkStatus === "ready",
    restore,
    presentPaywall,
    presentPaywallIfNeeded,
  };
}

/**
 * The one call gate points make: returns true when the action may proceed and
 * otherwise reports `feature` to the provider's `onBlocked` (which opens the
 * paywall) and returns false. Before the verdict is settled it returns false
 * without reporting, so a paying user whose device has not answered yet is not
 * sent to the paywall; disable the control on `!settled` if that matters.
 */
export function useRequireEntitlement(feature: string): () => boolean {
  const { onBlocked } = usePurchasesContext();
  const { isEntitled, settled } = useEntitlement();
  return useCallback(() => {
    if (isEntitled) return true;
    if (settled) onBlocked?.(feature);
    return false;
  }, [feature, isEntitled, settled, onBlocked]);
}
