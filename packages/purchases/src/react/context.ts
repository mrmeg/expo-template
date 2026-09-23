import { createContext, useContext } from "react";

import type { EntitlementStore } from "../entitlementStore";
import type { PurchasesClient } from "../types";

export interface PurchasesContextValue {
  client: PurchasesClient;
  store: EntitlementStore;
  /** The provider's current `userId`, so hooks can tell when the store has been rescoped to it. */
  userId: string | null;
  /** Called by `useRequireEntitlement` / `PaywallGate` when access is blocked; the app pushes its paywall route here. */
  onBlocked?: (feature?: string) => void;
}

export const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function usePurchasesContext(): PurchasesContextValue {
  const value = useContext(PurchasesContext);
  if (!value) {
    throw new Error("@mrmeg/expo-purchases hooks and PaywallGate need a <PurchasesProvider> above them.");
  }
  return value;
}
