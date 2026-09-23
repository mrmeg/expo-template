/**
 * Renders `children` when the entitlement is active, otherwise `fallback`
 * (default nothing) and reports the block once per lock so the app can push its
 * paywall. Reports only once the verdict is `settled` (store scoped to the
 * user, snapshot read, and a source reported or none can), so a cold start or
 * an account switch never flashes the paywall at a paying user.
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
  const { isEntitled, settled } = useEntitlement(entitlement);
  const handler = onBlocked ?? context.onBlocked;
  const reported = useRef(false);

  useEffect(() => {
    if (isEntitled) {
      reported.current = false;
      return;
    }
    if (!settled || reported.current) return;
    reported.current = true;
    handler?.(feature);
  }, [isEntitled, settled, handler, feature]);

  return <>{isEntitled ? children : fallback}</>;
}
