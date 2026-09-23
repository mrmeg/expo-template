/**
 * Renders `children` when the entitlement is active, otherwise `fallback`
 * (default nothing) and reports the block once per lock so the app can push its
 * paywall. Waits for the snapshot to hydrate before reporting, so a cold start
 * does not flash the paywall at a paying user.
 */
import React, { useEffect, useRef, type ReactNode } from "react";

import { usePurchasesContext } from "./context";
import { useEntitlement } from "./hooks";

export interface PaywallGateProps {
  /** Feature name handed to `onBlocked` so the paywall can explain why. */
  feature?: string;
  /** Gate on another entitlement than the configured one (device active list only). */
  entitlement?: string;
  fallback?: ReactNode;
  /** Overrides the provider's `onBlocked` for this gate. */
  onBlocked?: (feature?: string) => void;
  children: ReactNode;
}

export function PaywallGate({ feature, entitlement, fallback = null, onBlocked, children }: PaywallGateProps) {
  const context = usePurchasesContext();
  const { isEntitled, hydrated } = useEntitlement(entitlement);
  const handler = onBlocked ?? context.onBlocked;
  const reported = useRef(false);

  useEffect(() => {
    if (isEntitled) {
      reported.current = false;
      return;
    }
    if (!hydrated || reported.current) return;
    reported.current = true;
    handler?.(feature);
  }, [isEntitled, hydrated, handler, feature]);

  return <>{isEntitled ? children : fallback}</>;
}
