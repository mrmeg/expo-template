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
import { Platform } from "react-native";

import { resolvePlatformKey, toCustomerState } from "./customerState";
import { loadPaywallUi, loadPurchasesSdk } from "./sdk";
import type { PaywallUi, PurchasesSdk, RcCustomerInfoListener, RcOffering } from "./sdkTypes";
import type {
  CustomerState,
  PaywallOutcome,
  PresentPaywallOptions,
  PurchasesClient,
  PurchasesConfig,
  PurchasesLogLevel,
  RestoreOutcome,
} from "./types";

/** `LOG_LEVEL` enum values are their own names; mirrored so the enum is never imported. */
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
  /**
   * Identity calls run one at a time. A sign-out followed quickly by a sign-in
   * must not let `logOut` land after `logIn` and leave the SDK anonymous.
   */
  let identityChain: Promise<unknown> = Promise.resolve();
  const serializeIdentity = <T>(task: () => Promise<T>): Promise<T> => {
    const next = identityChain.then(task, task);
    identityChain = next.catch(() => undefined);
    return next;
  };
  /** App listeners and the SDK listener each is attached through, once the SDK is ready. */
  const listeners = new Map<(state: CustomerState) => void, RcCustomerInfoListener | null>();

  /** The SDK once a configure in flight has settled; null when none succeeded. */
  const ready = async (): Promise<PurchasesSdk | null> => {
    if (!sdk && configurePromise) await configurePromise;
    return sdk;
  };

  const report = (error: unknown, context: string): void => {
    if (config.onError) {
      config.onError(error, context);
    } else if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`[expo-purchases] ${context} failed:`, error);
    }
  };

  const platformKey = (): string | undefined => resolvePlatformKey(config, Platform.OS);

  const getCustomerState = async (): Promise<CustomerState | null> => {
    const sdk = await ready();
    if (!sdk) return null;
    try {
      return toCustomerState(await sdk.getCustomerInfo(), config.entitlement);
    } catch (error) {
      report(error, "getCustomerInfo");
      return null;
    }
  };

  const attachListener = (listener: (state: CustomerState) => void): void => {
    if (!sdk || listeners.get(listener)) return;
    const sdkListener: RcCustomerInfoListener = (info) => listener(toCustomerState(info, config.entitlement));
    listeners.set(listener, sdkListener);
    sdk.addCustomerInfoUpdateListener(sdkListener);
  };

  /**
   * The `PurchasesOffering` to present: the requested id, else the configured
   * id, resolved through `getOfferings()`; the dashboard's current offering when
   * that id is unknown. Undefined when no id is wanted or offerings cannot be
   * loaded, which lets RevenueCatUI use its own default (the current offering).
   */
  const resolveOffering = async (offeringId?: string): Promise<RcOffering | undefined> => {
    const wanted = offeringId ?? config.offering;
    if (!sdk || !wanted) return undefined;
    try {
      const offerings = await sdk.getOfferings();
      return offerings.all?.[wanted] ?? offerings.current ?? undefined;
    } catch (error) {
      report(error, "getOfferings");
      return undefined;
    }
  };

  /** Shared paywall sequence: load the UI module, resolve the offering, present, map the result. */
  const present = async (
    context: "presentPaywall" | "presentPaywallIfNeeded",
    options: PresentPaywallOptions,
    invoke: (ui: PaywallUi, offering: RcOffering | undefined, displayCloseButton: boolean) => Promise<unknown>,
  ): Promise<PaywallOutcome> => {
    if (!(await ready())) return "not_configured";
    const ui = await loadPaywallUi();
    if (!ui) {
      report(new Error("react-native-purchases-ui is not installed in this build"), context);
      return "not_configured";
    }
    const offering = await resolveOffering(options.offering);
    try {
      return mapPaywallResult(await invoke(ui, offering, options.displayCloseButton ?? true));
    } catch (error) {
      report(error, context);
      return "error";
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
          // Reported once; a missing native module cannot appear later in this build.
          report(new Error("react-native-purchases is not installed in this build"), "load");
          return false;
        }
        try {
          if (config.logLevel) {
            await loaded.setLogLevel(LOG_LEVELS[config.logLevel]);
          }
          loaded.configure(appUserId ? { apiKey, appUserID: appUserId } : { apiKey });
          sdk = loaded;
          currentAppUserId = appUserId;
          for (const listener of listeners.keys()) attachListener(listener);
          return true;
        } catch (error) {
          report(error, "configure");
          configurePromise = null;
          return false;
        }
      })();
      return configurePromise;
    },

    logIn(appUserId) {
      return serializeIdentity(async () => {
        const sdk = await ready();
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
      });
    },

    logOut() {
      return serializeIdentity(async () => {
        const sdk = await ready();
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
      });
    },

    getCustomerState,

    async restore(): Promise<RestoreOutcome> {
      const sdk = await ready();
      if (!sdk) return { kind: "not_configured" };
      try {
        const customer = toCustomerState(await sdk.restorePurchases(), config.entitlement);
        return customer.isActive ? { kind: "restored", customer } : { kind: "none", customer };
      } catch (error) {
        report(error, "restore");
        return { kind: "failed", message: errorMessage(error, "Restore failed") };
      }
    },

    presentPaywall(options: PresentPaywallOptions = {}) {
      return present("presentPaywall", options, (ui, offering, displayCloseButton) =>
        ui.presentPaywall({ offering, displayCloseButton }),
      );
    },

    presentPaywallIfNeeded(options: PresentPaywallOptions = {}) {
      return present("presentPaywallIfNeeded", options, (ui, offering, displayCloseButton) =>
        ui.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: config.entitlement,
          offering,
          displayCloseButton,
        }),
      );
    },

    subscribe(listener) {
      // A listener already registered keeps its SDK binding; re-subscribing is a no-op.
      if (!listeners.has(listener)) {
        listeners.set(listener, null);
        attachListener(listener);
      }
      return () => {
        const sdkListener = listeners.get(listener);
        listeners.delete(listener);
        if (sdk && sdkListener) sdk.removeCustomerInfoUpdateListener(sdkListener);
      };
    },

    async setAttributes(attributes) {
      const sdk = await ready();
      if (!sdk) return;
      try {
        await sdk.setAttributes(attributes);
      } catch (error) {
        report(error, "setAttributes");
      }
    },
  };
}
