/**
 * Web twin of `sdk.native.ts`. Purchases are native-only, so neither SDK enters
 * the web bundle and web always runs unconfigured.
 */
import type { PaywallUi, PurchasesSdk } from "./sdkTypes";

export function loadPurchasesSdk(): Promise<PurchasesSdk | null> {
  return Promise.resolve(null);
}

export function loadPaywallUi(): Promise<PaywallUi | null> {
  return Promise.resolve(null);
}
