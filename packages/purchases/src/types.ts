/**
 * Public types for `@mrmeg/expo-purchases`.
 *
 * Everything the app touches is plain, serializable data: the SDK's
 * `CustomerInfo` is mapped to `CustomerState` at the boundary so stores,
 * hooks, and paywall screens never hold RevenueCat objects.
 */

export type PurchasesLogLevel = "verbose" | "debug" | "info" | "warn" | "error";

export interface PurchasesConfig {
  /** RevenueCat entitlement identifier that grants access (case sensitive). */
  entitlement: string;
  /** Offering identifier to present by default; the dashboard's current offering when omitted or unknown. */
  offering?: string;
  /** RevenueCat public SDK key for the App Store app (`appl_…`). */
  iosKey?: string;
  /** RevenueCat public SDK key for the Play Store app (`goog_…`). */
  androidKey?: string;
  /** Forwarded to `Purchases.setLogLevel` before configure. */
  logLevel?: PurchasesLogLevel;
  /**
   * Receives every swallowed SDK error with the entry point that produced it
   * (`"configure"`, `"logIn"`, `"presentPaywall"`, …). Wire it to Sentry.
   */
  onError?: (error: unknown, context: string) => void;
}

/** Plain-data view of the customer, keyed to the configured entitlement. */
export interface CustomerState {
  /** The configured entitlement is active on this device's RevenueCat customer. */
  isActive: boolean;
  /** Expiry of the configured entitlement in ms since epoch; null when inactive or lifetime. */
  until: number | null;
  willRenew: boolean;
  productId: string | null;
  managementUrl: string | null;
  appUserId: string | null;
  /** Every active entitlement identifier, for gates on a non-default entitlement. */
  activeEntitlements: string[];
}

export type PaywallOutcome =
  | "purchased"
  | "restored"
  | "cancelled"
  | "error"
  | "not_configured"
  | "not_presented";

export type RestoreOutcome =
  | { kind: "restored"; customer: CustomerState }
  | { kind: "none"; customer: CustomerState }
  | { kind: "failed"; message: string }
  | { kind: "not_configured" };

export interface PresentPaywallOptions {
  /** Offering identifier for this presentation; overrides `PurchasesConfig.offering`. */
  offering?: string;
  /** Show the close button on the paywall sheet. Default true. */
  displayCloseButton?: boolean;
}

export interface PurchasesClient {
  /** The configured entitlement identifier. */
  readonly entitlement: string;
  /** A public SDK key exists for the current platform. False on web. */
  isConfigured(): boolean;
  /** `configure()` succeeded this session and purchases can be made. */
  isReady(): boolean;
  /**
   * Configure the SDK once. Resolves false (and never throws) without a key
   * for this platform, when the native module is missing, or when the SDK
   * rejects the configuration.
   */
  configure(appUserId?: string | null): Promise<boolean>;
  /** Attach purchases to the app's user id. Skips the SDK call when already that user. */
  logIn(appUserId: string): Promise<CustomerState | null>;
  /** Return the SDK to an anonymous id after sign-out. */
  logOut(): Promise<void>;
  getCustomerState(): Promise<CustomerState | null>;
  restore(): Promise<RestoreOutcome>;
  /** Present the dashboard paywall (`RevenueCatUI.presentPaywall`). */
  presentPaywall(options?: PresentPaywallOptions): Promise<PaywallOutcome>;
  /** Present the paywall only when the configured entitlement is missing. */
  presentPaywallIfNeeded(options?: PresentPaywallOptions): Promise<PaywallOutcome>;
  /** Customer-info updates (purchase, restore, renewal, expiry). Inert before `configure`. */
  subscribe(listener: (state: CustomerState) => void): () => void;
  /** Forward subscriber attributes such as `$mediaSource` / `$campaign`. */
  setAttributes(attributes: Record<string, string | null>): Promise<void>;
}
