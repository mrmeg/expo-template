/**
 * SDK → plain-data mapping. Lifted from Mindmap `purchasesClient.toCustomerState`
 * with the entitlement id made a parameter and `activeEntitlements` added.
 */
import type { CustomerInfo } from "react-native-purchases";

import { resolvePlatformKey, toCustomerState } from "../customerState";

function customerInfo(
  overrides: {
    active?: string[];
    expirationMs?: number | null;
    expirationIso?: string | null;
    willRenew?: boolean;
    managementURL?: string | null;
    appUserId?: string;
  } = {},
): CustomerInfo {
  const {
    active = [],
    expirationMs = 1_800_000_000_000,
    expirationIso = expirationMs === null ? null : new Date(expirationMs).toISOString(),
    willRenew = true,
    managementURL = null,
    appUserId = "user-1",
  } = overrides;
  const entitlementFor = (identifier: string) => ({
    identifier,
    isActive: true,
    willRenew,
    expirationDate: expirationIso,
    expirationDateMillis: expirationMs,
    productIdentifier: `app_${identifier}_annual`,
    store: "APP_STORE",
  });
  const activeMap = Object.fromEntries(active.map((id) => [id, entitlementFor(id)]));
  return {
    entitlements: { active: activeMap, all: { ...activeMap, pro: entitlementFor("pro") } },
    managementURL,
    originalAppUserId: appUserId,
  } as unknown as CustomerInfo;
}

describe("toCustomerState", () => {
  it("reports an inactive customer with management and identity fields", () => {
    expect(toCustomerState(customerInfo({ managementURL: "https://manage" }), "pro")).toEqual({
      isActive: false,
      until: null,
      willRenew: false,
      productId: null,
      managementUrl: "https://manage",
      appUserId: "user-1",
      activeEntitlements: [],
    });
  });

  it("reports the active entitlement with its expiry, renewal flag, and product", () => {
    expect(toCustomerState(customerInfo({ active: ["pro"], willRenew: false }), "pro")).toEqual({
      isActive: true,
      until: 1_800_000_000_000,
      willRenew: false,
      productId: "app_pro_annual",
      managementUrl: null,
      appUserId: "user-1",
      activeEntitlements: ["pro"],
    });
  });

  it("treats a lifetime entitlement (no expiration) as active with null until", () => {
    const state = toCustomerState(customerInfo({ active: ["pro"], expirationMs: null }), "pro");
    expect(state.isActive).toBe(true);
    expect(state.until).toBeNull();
  });

  it("falls back to parsing the ISO expiration when millis are missing", () => {
    const info = customerInfo({ active: ["pro"], expirationMs: null, expirationIso: "2027-01-01T00:00:00.000Z" });
    expect(toCustomerState(info, "pro").until).toBe(Date.parse("2027-01-01T00:00:00.000Z"));
  });

  it("lists every active entitlement but keys isActive off the configured one", () => {
    const state = toCustomerState(customerInfo({ active: ["other", "pro"] }), "premium");
    expect(state.isActive).toBe(false);
    expect(state.activeEntitlements).toEqual(["other", "pro"]);
  });
});

describe("resolvePlatformKey", () => {
  const config = { iosKey: "appl_x", androidKey: "goog_y" };

  it("picks the key for the platform and trims blanks to undefined", () => {
    expect(resolvePlatformKey(config, "ios")).toBe("appl_x");
    expect(resolvePlatformKey(config, "android")).toBe("goog_y");
    expect(resolvePlatformKey({ iosKey: "  " }, "ios")).toBeUndefined();
    expect(resolvePlatformKey({}, "android")).toBeUndefined();
  });

  it("has no key on web or any other platform", () => {
    expect(resolvePlatformKey(config, "web")).toBeUndefined();
    expect(resolvePlatformKey(config, "macos")).toBeUndefined();
  });
});
