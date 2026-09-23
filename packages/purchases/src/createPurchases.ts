/**
 * `createPurchases(config)`: a small, stable surface over `react-native-purchases`
 * and `react-native-purchases-ui`.
 *
 * Every entry point resolves gracefully (`false`, `null`, `not_configured`) when
 * the SDK is unavailable — no key for this platform, web, or a dev client built
 * before the native module was added — and reports swallowed SDK errors through
 * `config.onError`. Lifted from NeuroSpicy
 * `client/services/subscription/revenuecat.native.ts` (configure, identify,
 * paywall result mapping, restore, attributes) and Mindmap
 * `client/features/pro/purchasesClient.ts` (one-time configure, identity
 * bookkeeping, customer-info listener).
 */
import type { CustomerInfo, LOG_LEVEL, PurchasesOffering } from "react-native-purchases";
import { Platform } from "react-native";

import { resolvePlatformKey, toCustomerState } from "./customerState";
import { loadPaywallUi, loadPurchasesSdk } from "./sdk";
import type { PurchasesSdk } from "./sdkTypes";
import type {
  CustomerState,
  PaywallOutcome,
  PresentPaywallOptions,
  PurchasesClient,
  PurchasesConfig,
  PurchasesLogLevel,
  RestoreOutcome,
} from "./types";

/** `LOG_LEVEL` enum values are their own names; mirrored so the enum is never imported at runtime. */
const LOG_LEVELS: Record<PurchasesLogLevel, string> = {
  verbose: "VERBOSE",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

/** `PAYWALL_RESULT` values are their own names; compared as strings for the same reason. */
export function mapPaywallResult(result: unknown): PaywallOutcome {
  switch (result) {
    case "PURCHASED":
      return "purchased";
    case "RESTORED":
      return "restored";
    case "CANCELLED":
      return "cancelled";
    case "NOT_PRESENTED":
      return "not_presented";
    default:
      return "error";
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function createPurchases(config: PurchasesConfig): PurchasesClient {
  let sdk: PurchasesSdk | null = null;
  let configurePromise: Promise<boolean> | null = null;
  /** App user id the SDK currently holds; `undefined` until configure runs. */
  let currentAppUserId: string | null | undefined;

  const report = (error: unknown, context: string): void => {
    if (config.onError) {
      config.onError(error, context);
    } else if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`[expo-purchases] ${context} failed:`, error);
    }
  };

  const platformKey = (): string | undefined => resolvePlatformKey(config, Platform.OS);

  const getCustomerState = async (): Promise<CustomerState | null> => {
    if (!sdk) return null;
    try {
      return toCustomerState(await sdk.getCustomerInfo(), config.entitlement);
    } catch (error) {
      report(error, "getCustomerInfo");
      return null;
    }
  };

  /**
   * The `PurchasesOffering` to present: the requested id, else the configured
   * id, else the dashboard's current offering. Undefined when offerings cannot
   * be loaded, which lets RevenueCatUI fall back to its own default.
   */
  const resolveOffering = async (offeringId?: string): Promise<PurchasesOffering | undefined> => {
    if (!sdk) return undefined;
    const wanted = offeringId ?? config.offering;
    try {
      const offerings = await sdk.getOfferings();
      const byId = wanted ? offerings.all?.[wanted] : undefined;
      return byId ?? offerings.current ?? undefined;
    } catch (error) {
      report(error, "getOfferings");
      return undefined;
    }
  };

  return {
    entitlement: config.entitlement,

    isConfigured: () => platformKey() !== undefined,

    isReady: () => sdk !== null,

    configure(appUserId = null) {
      if (configurePromise) return configurePromise;
      const apiKey = platformKey();
      if (!apiKey) return Promise.resolve(false);
      configurePromise = (async () => {
        const loaded = await loadPurchasesSdk();
        if (!loaded) {
          report(new Error("react-native-purchases is not installed in this build"), "load");
          configurePromise = null;
          return false;
        }
        try {
          if (config.logLevel) {
            await loaded.setLogLevel(LOG_LEVELS[config.logLevel] as unknown as LOG_LEVEL);
          }
          loaded.configure(appUserId ? { apiKey, appUserID: appUserId } : { apiKey });
          sdk = loaded;
          currentAppUserId = appUserId;
          return true;
        } catch (error) {
          report(error, "configure");
          configurePromise = null;
          return false;
        }
      })();
      return configurePromise;
    },

    async logIn(appUserId) {
      if (!sdk) return null;
      if (currentAppUserId === appUserId) return getCustomerState();
      try {
        const result = await sdk.logIn(appUserId);
        currentAppUserId = appUserId;
        return toCustomerState(result.customerInfo, config.entitlement);
      } catch (error) {
        report(error, "logIn");
        return null;
      }
    },

    async logOut() {
      if (!sdk) return;
      try {
        if (!(await sdk.isAnonymous())) {
          await sdk.logOut();
        }
      } catch (error) {
        report(error, "logOut");
      } finally {
        currentAppUserId = null;
      }
    },

    getCustomerState,

    async restore(): Promise<RestoreOutcome> {
      if (!sdk) return { kind: "not_configured" };
      try {
        const customer = toCustomerState(await sdk.restorePurchases(), config.entitlement);
        return customer.isActive ? { kind: "restored", customer } : { kind: "none", customer };
      } catch (error) {
        report(error, "restore");
        return { kind: "failed", message: errorMessage(error, "Restore failed") };
      }
    },

    async presentPaywall(options: PresentPaywallOptions = {}) {
      if (!sdk) return "not_configured";
      const ui = await loadPaywallUi();
      if (!ui) {
        report(new Error("react-native-purchases-ui is not installed in this build"), "presentPaywall");
        return "not_configured";
      }
      const offering = await resolveOffering(options.offering);
      try {
        const result = await ui.presentPaywall({
          offering,
          displayCloseButton: options.displayCloseButton ?? true,
        });
        return mapPaywallResult(result);
      } catch (error) {
        report(error, "presentPaywall");
        return "error";
      }
    },

    async presentPaywallIfNeeded(options: PresentPaywallOptions = {}) {
      if (!sdk) return "not_configured";
      const ui = await loadPaywallUi();
      if (!ui) {
        report(new Error("react-native-purchases-ui is not installed in this build"), "presentPaywallIfNeeded");
        return "not_configured";
      }
      const offering = await resolveOffering(options.offering);
      try {
        const result = await ui.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: config.entitlement,
          offering,
          displayCloseButton: options.displayCloseButton ?? true,
        });
        return mapPaywallResult(result);
      } catch (error) {
        report(error, "presentPaywallIfNeeded");
        return "error";
      }
    },

    subscribe(listener) {
      let disposed = false;
      let attached: ((info: CustomerInfo) => void) | null = null;
      let attachedTo: PurchasesSdk | null = null;

      void (configurePromise ?? Promise.resolve(false)).then(() => {
        if (disposed || !sdk) return;
        attachedTo = sdk;
        attached = (info) => listener(toCustomerState(info, config.entitlement));
        sdk.addCustomerInfoUpdateListener(attached);
      });

      return () => {
        disposed = true;
        if (attachedTo && attached) {
          attachedTo.removeCustomerInfoUpdateListener(attached);
        }
      };
    },

    async setAttributes(attributes) {
      if (!sdk) return;
      try {
        await sdk.setAttributes(attributes);
      } catch (error) {
        report(error, "setAttributes");
      }
    },
  };
}
