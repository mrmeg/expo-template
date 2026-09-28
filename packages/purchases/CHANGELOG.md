# Changelog

All notable changes to `@mrmeg/expo-purchases` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Relative imports in the built `.d.ts` files carry `.js` or `/index.js`, so a
  consumer on `moduleResolution: nodenext` gets the real types instead of
  `any` (28 were extension-less).

### Changed

- `exports` entries list a repo-only `@mrmeg/source` condition first, pointing
  at `src`, for the template's own builds and tests. Consumers never set it and
  resolve the same `dist` files.

## [0.1.0]

First release. The RevenueCat client, entitlement state, gating, and pure
webhook code that NeuroSpicy and Mindmap each carried in-app, extracted into one
package.

### Added

- `createPurchases({ entitlement, offering?, iosKey?, androidKey?, logLevel?, onError? })`
  (`@mrmeg/expo-purchases`): `configure`, `logIn`, `logOut`, `getCustomerState`,
  `restore`, `presentPaywall`, `presentPaywallIfNeeded`, `subscribe`,
  `setAttributes`. Every entry point resolves `false` / `null` /
  `not_configured` instead of throwing when the SDK is unavailable.
- Platform split: `sdk.native` requires `react-native-purchases` and
  `react-native-purchases-ui` lazily, only after a public key exists for the
  platform; the web twin never references either module, so neither enters the
  web bundle.
- `createEntitlementStore({ storage?, storageKeyPrefix? })` and
  `resolveEntitlement()`: on-device customer state, the server's webhook-synced
  expiry, and a per-user persisted snapshot merged in that trust order.
- `PurchasesProvider`, `useEntitlement()` (with `settled`: act on the verdict
  only once the store is scoped to the user and a source has reported),
  `useRequireEntitlement(feature)`, `<PaywallGate>`. The package never imports a
  router; the app's `onBlocked` opens its paywall route.
- `@mrmeg/expo-purchases/server` (no React, React Native, Node, or SDK imports):
  `isAuthorizedWebhook`, `timingSafeEqual`, `parseRevenueCatWebhook`,
  `reduceEntitlement`, `revokedByTransfer`, `buildLedgerRows`,
  `isRefundCancellation`, `deriveSubscriptionStatus`, `providerSubscriptionId`,
  `createWebhookHandler`, `LIFETIME_UNTIL`. The reducer keeps one record per
  entitlement across products: grants never shorten `until`, an ordinary
  `EXPIRATION` never cuts a longer term, and a refund `CANCELLATION` or a
  customer-support / developer-initiated `EXPIRATION` revokes immediately.
  Ledger amounts are positive on sales and renewals, negative on refunds, null
  on state-only rows.
- Docs: identifier contract, the human setup checklist, the store-review
  checklist (Terms of Use and Privacy Policy links on the paywall).
