/**
 * `createPurchases` against mocked RevenueCat SDKs. Covers the key gate per
 * platform, one-time configure, identity calls, restore, paywall result mapping
 * (lifted from NeuroSpicy `revenuecat.native.ts`), offering resolution by id, and
 * the customer-info listener (lifted from Mindmap `purchasesClient.ts`).
 */
import type { CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";

const mockSdk = {
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  isAnonymous: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  restorePurchases: jest.fn(),
  setAttributes: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
};

const mockUi = {
  presentPaywall: jest.fn(),
  presentPaywallIfNeeded: jest.fn(),
};

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: mockSdk,
  LOG_LEVEL: { VERBOSE: "VERBOSE", DEBUG: "DEBUG", INFO: "INFO", WARN: "WARN", ERROR: "ERROR" },
}));

jest.mock("react-native-purchases-ui", () => ({
  __esModule: true,
  default: mockUi,
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
}));

import { createPurchases } from "../createPurchases";
import { resetSdkCache } from "../sdk";

const ENTITLEMENT = "pro";
const UNTIL = 1_800_000_000_000;

function customerInfo(active = false, appUserId = "user-1"): CustomerInfo {
  const entitlement = {
    identifier: ENTITLEMENT,
    isActive: true,
    willRenew: true,
    expirationDate: new Date(UNTIL).toISOString(),
    expirationDateMillis: UNTIL,
    productIdentifier: "app_pro_annual",
    store: "APP_STORE",
  };
  return {
    entitlements: { active: active ? { [ENTITLEMENT]: entitlement } : {}, all: { [ENTITLEMENT]: entitlement } },
    managementURL: null,
    originalAppUserId: appUserId,
  } as unknown as CustomerInfo;
}

const offerings = {
  current: { identifier: "default", availablePackages: [] },
  all: {
    default: { identifier: "default", availablePackages: [] },
    launch: { identifier: "launch", availablePackages: [] },
  },
};

function makeClient(overrides: Partial<Parameters<typeof createPurchases>[0]> = {}) {
  return createPurchases({ entitlement: ENTITLEMENT, iosKey: "appl_x", androidKey: "goog_y", ...overrides });
}

describe("createPurchases (native)", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    resetSdkCache();
    for (const fn of Object.values(mockSdk)) fn.mockReset();
    for (const fn of Object.values(mockUi)) fn.mockReset();
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo(false));
    mockSdk.getOfferings.mockResolvedValue(offerings);
    mockSdk.isAnonymous.mockResolvedValue(false);
    mockSdk.logIn.mockImplementation(async (id: string) => ({ customerInfo: customerInfo(true, id), created: false }));
    mockSdk.logOut.mockResolvedValue(customerInfo(false));
    mockSdk.restorePurchases.mockResolvedValue(customerInfo(true));
    mockSdk.setAttributes.mockResolvedValue(undefined);
    mockSdk.setLogLevel.mockResolvedValue(undefined);
    Platform.OS = "ios";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("uses the ios key on ios and the android key on android", async () => {
    expect(makeClient().isConfigured()).toBe(true);
    await makeClient().configure("user-1");
    expect(mockSdk.configure).toHaveBeenLastCalledWith({ apiKey: "appl_x", appUserID: "user-1" });

    Platform.OS = "android";
    await makeClient().configure(null);
    expect(mockSdk.configure).toHaveBeenLastCalledWith({ apiKey: "goog_y" });
  });

  it("configures once, remembers readiness, and applies the log level", async () => {
    const client = makeClient({ logLevel: "debug" });
    expect(client.isReady()).toBe(false);
    await expect(client.configure("user-1")).resolves.toBe(true);
    await expect(client.configure("user-1")).resolves.toBe(true);
    expect(mockSdk.configure).toHaveBeenCalledTimes(1);
    expect(mockSdk.setLogLevel).toHaveBeenCalledWith("DEBUG");
    expect(client.isReady()).toBe(true);
  });

  it("reports configure failures through onError and stays unconfigured", async () => {
    const onError = jest.fn();
    mockSdk.configure.mockImplementation(() => {
      throw new Error("no native module");
    });
    const client = makeClient({ onError });
    await expect(client.configure("user-1")).resolves.toBe(false);
    expect(client.isReady()).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "configure");
    await expect(client.presentPaywall()).resolves.toBe("not_configured");
  });

  it("logs in a new user and skips the SDK call when already that user", async () => {
    const client = makeClient();
    await client.configure("user-1");
    const same = await client.logIn("user-1");
    expect(mockSdk.logIn).not.toHaveBeenCalled();
    expect(same).toMatchObject({ isActive: false, appUserId: "user-1" });

    const switched = await client.logIn("user-2");
    expect(mockSdk.logIn).toHaveBeenCalledWith("user-2");
    expect(switched).toMatchObject({ isActive: true, appUserId: "user-2", until: UNTIL });
  });

  it("returns null and reports when logIn throws", async () => {
    const onError = jest.fn();
    const client = makeClient({ onError });
    await client.configure(null);
    mockSdk.logIn.mockRejectedValueOnce(new Error("offline"));
    await expect(client.logIn("user-9")).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "logIn");
  });

  it("logs out only when the SDK is not already anonymous", async () => {
    const client = makeClient();
    await client.configure("user-1");
    mockSdk.isAnonymous.mockResolvedValueOnce(true);
    await client.logOut();
    expect(mockSdk.logOut).not.toHaveBeenCalled();
    await client.logOut();
    expect(mockSdk.logOut).toHaveBeenCalledTimes(1);
    // After logOut the next logIn for the same id hits the SDK again.
    await client.logIn("user-1");
    expect(mockSdk.logIn).toHaveBeenCalledWith("user-1");
  });

  it("maps getCustomerState and swallows SDK failures", async () => {
    const client = makeClient();
    await client.configure("user-1");
    mockSdk.getCustomerInfo.mockResolvedValueOnce(customerInfo(true));
    expect(await client.getCustomerState()).toMatchObject({ isActive: true, productId: "app_pro_annual" });
    mockSdk.getCustomerInfo.mockRejectedValueOnce(new Error("offline"));
    expect(await client.getCustomerState()).toBeNull();
  });

  it("restores purchases into restored, none, or failed outcomes", async () => {
    const client = makeClient();
    await client.configure("user-1");
    expect(await client.restore()).toMatchObject({ kind: "restored", customer: { isActive: true } });
    mockSdk.restorePurchases.mockResolvedValueOnce(customerInfo(false));
    expect(await client.restore()).toMatchObject({ kind: "none", customer: { isActive: false } });
    mockSdk.restorePurchases.mockRejectedValueOnce(new Error("store unavailable"));
    expect(await client.restore()).toEqual({ kind: "failed", message: "store unavailable" });
  });

  it.each([
    ["PURCHASED", "purchased"],
    ["RESTORED", "restored"],
    ["CANCELLED", "cancelled"],
    ["ERROR", "error"],
    ["NOT_PRESENTED", "not_presented"],
    ["SOMETHING_ELSE", "error"],
  ])("maps paywall result %s to %s", async (result, outcome) => {
    const client = makeClient();
    await client.configure("user-1");
    mockUi.presentPaywall.mockResolvedValueOnce(result);
    expect(await client.presentPaywall()).toBe(outcome);
  });

  it("presents the configured offering by id, falls back to current, and honours a per-call override", async () => {
    mockUi.presentPaywall.mockResolvedValue("CANCELLED");
    const client = makeClient({ offering: "launch" });
    await client.configure("user-1");
    await client.presentPaywall();
    expect(mockUi.presentPaywall).toHaveBeenLastCalledWith({ offering: offerings.all.launch, displayCloseButton: true });

    await client.presentPaywall({ offering: "missing", displayCloseButton: false });
    expect(mockUi.presentPaywall).toHaveBeenLastCalledWith({ offering: offerings.current, displayCloseButton: false });

    // No offering configured or requested: no getOfferings round-trip, RevenueCatUI picks current.
    mockSdk.getOfferings.mockClear();
    const plain = makeClient();
    await plain.configure("user-1");
    await plain.presentPaywall();
    expect(mockSdk.getOfferings).not.toHaveBeenCalled();
    expect(mockUi.presentPaywall).toHaveBeenLastCalledWith({ offering: undefined, displayCloseButton: true });
  });

  it("still presents when offerings cannot be loaded", async () => {
    mockSdk.getOfferings.mockRejectedValueOnce(new Error("offline"));
    mockUi.presentPaywall.mockResolvedValueOnce("PURCHASED");
    const client = makeClient({ offering: "launch" });
    await client.configure("user-1");
    expect(await client.presentPaywall()).toBe("purchased");
    expect(mockUi.presentPaywall).toHaveBeenLastCalledWith({ offering: undefined, displayCloseButton: true });
  });

  it("presents the paywall only if the entitlement is missing", async () => {
    mockUi.presentPaywallIfNeeded.mockResolvedValueOnce("NOT_PRESENTED");
    const client = makeClient({ offering: "launch" });
    await client.configure("user-1");
    expect(await client.presentPaywallIfNeeded()).toBe("not_presented");
    expect(mockUi.presentPaywallIfNeeded).toHaveBeenLastCalledWith({
      requiredEntitlementIdentifier: ENTITLEMENT,
      offering: offerings.all.launch,
      displayCloseButton: true,
    });
  });

  it("maps a throwing paywall to error and reports it", async () => {
    const onError = jest.fn();
    mockUi.presentPaywall.mockRejectedValueOnce(new Error("no window"));
    const client = makeClient({ onError });
    await client.configure("user-1");
    expect(await client.presentPaywall()).toBe("error");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "presentPaywall");
  });

  it("forwards subscriber attributes and swallows failures", async () => {
    const onError = jest.fn();
    const client = makeClient({ onError });
    await client.configure("user-1");
    await client.setAttributes({ $mediaSource: "instagram", $campaign: null });
    expect(mockSdk.setAttributes).toHaveBeenCalledWith({ $mediaSource: "instagram", $campaign: null });
    mockSdk.setAttributes.mockRejectedValueOnce(new Error("nope"));
    await expect(client.setAttributes({ $mediaSource: "x" })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "setAttributes");
  });

  it("delivers mapped customer updates to subscribers until unsubscribed", async () => {
    const client = makeClient();
    await client.configure("user-1");
    const listener = jest.fn();
    const unsubscribe = client.subscribe(listener);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSdk.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    const sdkListener = mockSdk.addCustomerInfoUpdateListener.mock.calls[0][0] as (info: CustomerInfo) => void;
    sdkListener(customerInfo(true));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isActive: true, until: UNTIL }));
    unsubscribe();
    expect(mockSdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(sdkListener);
  });

  it("does not attach a listener that was unsubscribed before configure completed", async () => {
    const client = makeClient();
    const unsubscribe = client.subscribe(() => {});
    unsubscribe();
    await client.configure("user-1");
    expect(mockSdk.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
    expect(mockSdk.removeCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });

  it("subscribe is inert before configure and attaches once configure succeeds", async () => {
    const client = makeClient();
    const listener = jest.fn();
    const unsubscribe = client.subscribe(listener);
    await Promise.resolve();
    expect(mockSdk.addCustomerInfoUpdateListener).not.toHaveBeenCalled();

    await client.configure("user-1");
    expect(mockSdk.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    const sdkListener = mockSdk.addCustomerInfoUpdateListener.mock.calls[0][0] as (info: CustomerInfo) => void;
    sdkListener(customerInfo(true));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    unsubscribe();
    expect(mockSdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(sdkListener);
  });

  it("attaches after a failed configure is retried successfully", async () => {
    mockSdk.configure.mockImplementationOnce(() => {
      throw new Error("first attempt");
    });
    const client = makeClient({ onError: () => {} });
    client.subscribe(() => {});
    await expect(client.configure("user-1")).resolves.toBe(false);
    expect(mockSdk.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
    await expect(client.configure("user-1")).resolves.toBe(true);
    expect(mockSdk.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
  });

  it("runs identity calls one at a time so a slow logOut cannot land after the next logIn", async () => {
    const client = makeClient();
    await client.configure("user-1");
    const order: string[] = [];
    let releaseLogOut!: () => void;
    mockSdk.logOut.mockImplementationOnce(
      () =>
        new Promise<CustomerInfo>((resolve) => {
          releaseLogOut = () => {
            order.push("logOut");
            resolve(customerInfo(false));
          };
        }),
    );
    mockSdk.logIn.mockImplementation(async (id: string) => {
      order.push(`logIn:${id}`);
      return { customerInfo: customerInfo(true, id), created: false };
    });

    const signOut = client.logOut();
    const signIn = client.logIn("user-2");
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    releaseLogOut();
    await signOut;
    const state = await signIn;
    expect(order).toEqual(["logOut", "logIn:user-2"]);
    expect(state).toMatchObject({ appUserId: "user-2", isActive: true });
  });
});
