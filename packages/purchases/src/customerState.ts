/**
 * Boundary mapping from RevenueCat's `CustomerInfo` to plain `CustomerState`.
 * Lifted from Mindmap `purchasesClient.toCustomerState`, generalised to any
 * entitlement id and extended with the list of active entitlements.
 */
import type { CustomerInfo } from "react-native-purchases";

import type { CustomerState, PurchasesConfig } from "./types";

export function toCustomerState(info: CustomerInfo, entitlement: string): CustomerState {
  const active = info.entitlements?.active ?? {};
  const activeEntitlements = Object.keys(active);
  const current = active[entitlement];
  if (!current) {
    return {
      isActive: false,
      until: null,
      willRenew: false,
      productId: null,
      managementUrl: info.managementURL ?? null,
      appUserId: info.originalAppUserId ?? null,
      activeEntitlements,
    };
  }
  const until =
    current.expirationDateMillis ??
    (current.expirationDate ? Date.parse(current.expirationDate) : null);
  return {
    isActive: true,
    until: typeof until === "number" && Number.isFinite(until) ? until : null,
    willRenew: current.willRenew,
    productId: current.productIdentifier,
    managementUrl: info.managementURL ?? null,
    appUserId: info.originalAppUserId ?? null,
    activeEntitlements,
  };
}

/**
 * Public SDK key for a platform, or undefined. Blank strings count as unset so a
 * `.env` line with no value keeps the app in free mode. Web and every other
 * platform have no key: purchases are native-only.
 */
export function resolvePlatformKey(
  config: Pick<PurchasesConfig, "iosKey" | "androidKey">,
  platform: string,
): string | undefined {
  const raw = platform === "ios" ? config.iosKey : platform === "android" ? config.androidKey : undefined;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
