/**
 * Type-only view of the optional RevenueCat peers. Kept apart from the loaders so
 * the web twin (`sdk.ts`) contains no reference to either module.
 */
export type PurchasesSdk = typeof import("react-native-purchases").default;
export type PaywallUi = typeof import("react-native-purchases-ui").default;
