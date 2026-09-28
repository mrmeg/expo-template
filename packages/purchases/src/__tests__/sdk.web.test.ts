/**
 * The web twin of the SDK loader never imports RevenueCat, and a client built on
 * a platform without a key answers `not_configured` everywhere instead of
 * throwing. `../sdk.ts` is loaded by explicit filename through `require` so Jest
 * skips its platform resolution (which would otherwise pick `sdk.native.ts`).
 */
import { Platform } from "react-native";

import { createPurchases } from "../createPurchases";

const webSdk = require("../sdk.ts") as typeof import("../sdk");

describe("sdk (web twin)", () => {
  it("resolves null for both loaders", async () => {
    await expect(webSdk.loadPurchasesSdk()).resolves.toBeNull();
    await expect(webSdk.loadPaywallUi()).resolves.toBeNull();
  });

  it("never mentions the RevenueCat modules in its source", () => {
        const source = require("node:fs").readFileSync(require.resolve("../sdk.ts"), "utf8") as string;
    expect(source).not.toMatch(/react-native-purchases/);
  });
});

describe("createPurchases without a platform key", () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("reports not configured and answers every entry point safely on web", async () => {
    Platform.OS = "web";
    const client = createPurchases({ entitlement: "pro", iosKey: "appl_x", androidKey: "goog_y" });
    expect(client.isConfigured()).toBe(false);
    await expect(client.configure("user-1")).resolves.toBe(false);
    expect(client.isReady()).toBe(false);
    await expect(client.logIn("user-1")).resolves.toBeNull();
    await expect(client.logOut()).resolves.toBeUndefined();
    await expect(client.getCustomerState()).resolves.toBeNull();
    await expect(client.restore()).resolves.toEqual({ kind: "not_configured" });
    await expect(client.presentPaywall()).resolves.toBe("not_configured");
    await expect(client.presentPaywallIfNeeded()).resolves.toBe("not_configured");
    await expect(client.setAttributes({ $mediaSource: "x" })).resolves.toBeUndefined();
    const unsubscribe = client.subscribe(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it("reports not configured on ios when no ios key is supplied", async () => {
    Platform.OS = "ios";
    const client = createPurchases({ entitlement: "pro", androidKey: "goog_y" });
    expect(client.isConfigured()).toBe(false);
    await expect(client.presentPaywall()).resolves.toBe("not_configured");
  });
});
