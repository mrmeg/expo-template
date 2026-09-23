/**
 * Structural view of the optional RevenueCat peers, declared locally so the
 * published `.d.ts` files never import `react-native-purchases` or
 * `react-native-purchases-ui`: a web-only or server-only consumer type-checks
 * without either installed. Only the members this package uses are declared;
 * `src/__tests__/sdkTypes.test.ts` asserts against the real SDK types that these
 * stay assignable.
 */

export interface RcEntitlementInfo {
  readonly identifier: string;
  readonly isActive: boolean;
  readonly willRenew: boolean;
  readonly expirationDate: string | null;
  readonly expirationDateMillis: number | null;
  readonly productIdentifier: string;
}

export interface RcCustomerInfo {
  readonly entitlements: {
    readonly active: { readonly [key: string]: RcEntitlementInfo };
    readonly all: { readonly [key: string]: RcEntitlementInfo };
  };
  readonly managementURL: string | null;
  readonly originalAppUserId: string;
}

/** Opaque to this package; handed straight from `getOfferings()` to RevenueCatUI. */
export interface RcOffering {
  readonly identifier: string;
}

export interface RcOfferings {
  readonly current: RcOffering | null;
  readonly all: { readonly [key: string]: RcOffering };
}

export interface RcLogInResult {
  readonly customerInfo: RcCustomerInfo;
  readonly created: boolean;
}

export type RcCustomerInfoListener = (info: RcCustomerInfo) => void;

/** `react-native-purchases` default export, the static `Purchases` class. */
export interface PurchasesSdk {
  configure(configuration: { apiKey: string; appUserID?: string | null }): void;
  setLogLevel(level: string): Promise<void>;
  logIn(appUserID: string): Promise<RcLogInResult>;
  logOut(): Promise<RcCustomerInfo>;
  isAnonymous(): Promise<boolean>;
  getCustomerInfo(): Promise<RcCustomerInfo>;
  getOfferings(): Promise<RcOfferings>;
  restorePurchases(): Promise<RcCustomerInfo>;
  setAttributes(attributes: { [key: string]: string | null }): Promise<void>;
  addCustomerInfoUpdateListener(listener: RcCustomerInfoListener): void;
  removeCustomerInfoUpdateListener(listener: RcCustomerInfoListener): boolean;
}

/** `react-native-purchases-ui` default export, the static `RevenueCatUI` class. */
export interface PaywallUi {
  presentPaywall(params?: {
    offering?: RcOffering;
    displayCloseButton?: boolean;
  }): Promise<string>;
  presentPaywallIfNeeded(params: {
    requiredEntitlementIdentifier: string;
    offering?: RcOffering | null;
    displayCloseButton?: boolean;
  }): Promise<string>;
}
