# @mrmeg/expo-purchases Full Contract

Package-owned: the RevenueCat SDK wrapper, the plain `CustomerState` shape, the
entitlement store (device state + server expiry + persisted snapshot), the React
provider / hooks / gate, and the pure webhook helpers. App-owned: the RevenueCat
dashboard, keys and env names, auth and the user id, the paywall route and any
custom paywall UI, the backend record of `until`, idempotency and ledger tables,
user lookup, emails, analytics. Every peer is optional; `/server` runs without
React, React Native, Node APIs, or the SDKs. The SDK loader is platform split
(`sdk.js` / `sdk.native.js`, extension-less specifier) so Metro picks the native
loader on iOS/Android and neither SDK enters the web bundle.

Entrypoints: `.` (client, store, React) and `/server`.

## Client

`createPurchases({ entitlement, offering?, iosKey?, androidKey?, logLevel?,
onError? })` → `PurchasesClient`:

- `isConfigured()`: a key exists for `Platform.OS` (never on web).
- `isReady()`: `configure()` succeeded this session.
- `configure(appUserId?)`: once; loads the SDK lazily; applies `logLevel`;
  resolves false and reports through `onError` on any failure.
- `logIn(appUserId)`: skips the SDK when already that id; returns
  `CustomerState | null`.
- `logOut()`: only when not already anonymous.
- `getCustomerState()`, `restore()` (`restored | none | failed |
  not_configured`), `setAttributes(record)`.
- `presentPaywall({ offering?, displayCloseButton? })` and
  `presentPaywallIfNeeded(options?)`: RevenueCatUI; the offering id is resolved
  through `getOfferings().all[id]`, falling back to the current offering.
  Results: `purchased | restored | cancelled | error | not_configured |
  not_presented`.
- `subscribe(listener)`: customer-info updates as `CustomerState`; inert before
  configure; returns unsubscribe.

`CustomerState`: `{ isActive, until, willRenew, productId, managementUrl,
appUserId, activeEntitlements }`, keyed to the configured entitlement
(`toCustomerState(info, entitlement)`).

## Store

`createEntitlementStore({ storage?, storageKeyPrefix? })` (zustand vanilla):
state `sdkStatus`, `customer`, `serverUntil`, `snapshot`, `hydrated`,
`deviceReported`, `userId`, `devOverride`; actions `setSdkStatus`, `applyCustomerState`,
`applyServerEntitlement`, `hydrate(userId)`, `clear(userId?)`,
`setDevOverride` (development only), `reset`. `hydrate` rescopes first (drops
every source, `hydrated: false`) and `clear` leaves the signed-out scope
hydrated. The snapshot
`{ version, userId, savedAt, isActive, until }` is written on every live update
(revocations too) under `${prefix}${userId}`, rejected on user or version
mismatch, removed by `clear`.

`resolveEntitlement({ customer, serverUntil, snapshot, devOverride }, now?,
entitlement?)` → `{ isEntitled, until, source }` with source order `dev` →
`device` → `server` → `snapshot` (only while `customer === null && serverUntil
=== null`) → `none`. A non-default `entitlement` checks
`customer.activeEntitlements` only.

## React

`<PurchasesProvider client store userId serverUntil? onBlocked?>`: with a
user, hydrates the store for that user, configures once, subscribes, logs in,
mirrors `serverUntil`; with `userId={null}`, logs the SDK out and clears the
store and snapshot.

`useEntitlement(entitlement?)` → `{ isEntitled, until, source, hydrated,
settled, isConfigured, isReady, sdkStatus, customer, restore, presentPaywall,
presentPaywallIfNeeded }`; `settled` = scoped to this user, hydrated, and a
source reported (`deviceReported`, `serverUntil`, `snapshot`) or the SDK is
unavailable or there is no user. `useRequireEntitlement(feature)` → `() => boolean`
(false also calls the provider's `onBlocked(feature)`).
`<PaywallGate feature? entitlement? fallback? onBlocked?>` renders children when
entitled, else fallback, reporting once per lock after hydration.

## Server (`/server`)

- `isAuthorizedWebhook(header, secret)`: constant-time; bare or `Bearer`.
- `parseRevenueCatWebhook(body)` → `RevenueCatWebhookEvent | null`: camelCase
  `{ id, type, appUserId, originalAppUserId, aliases, productId,
  entitlementIds (legacy entitlement_id folded in), periodType, purchasedAtMs,
  expirationAtMs, eventTimestampMs, environment, store, originalTransactionId,
  cancelReason, expirationReason, price, priceInPurchasedCurrency, currency,
  renewalNumber, isTrialConversion, countryCode, offerCode, transferredFrom,
  transferredTo, raw }`; `raw` drops `subscriber_attributes`. Requires `id`,
  `type`, `event_timestamp_ms`, and `app_user_id` (except TRANSFER).
- `reduceEntitlement(current, event, { entitlement })` →
  `{ action: "set", next: { until, productId, updatedAt } }` for
  `GRANT_EVENT_TYPES` (later of current and event expiry; `LIFETIME_UNTIL` when
  none), `EXPIRATION` (event expiry unless the record runs longer), and a refund
  `CANCELLATION` (event expiry, unconditionally); else `{ action: "skip",
  reason: "not-entitlement" | "stale" | "no-op" }`. `revokedByTransfer(event)`.
- `buildLedgerRows(event, { userId, previouslyExpired? })` → `LedgerRow[]` over
  `LEDGER_EVENT_TYPES` (`trial_started`, `trial_converted`, `purchased`,
  `renewed`, `cancel_scheduled`, `uncanceled`, `expired`, `billing_issue`,
  `refunded`, `refund_reversed`, `product_changed`, `reactivated`).
  `isRefundCancellation`, `providerSubscriptionId`, `toAmountCents`,
  `deriveSubscriptionStatus` (`trialing | active | past_due | canceled`).
- `createWebhookHandler({ secret, onEvent, entitlement?, onError? })` →
  `(Request) => Promise<Response>`: 500 no secret, 401 bad header, 400 bad
  body, 200 `{ ok: true, ...result }`, 200 `{ ok: true, ignored: "entitlement" }`,
  500 when `onEvent` throws.

Idempotency, user lookup, the ledger table (unique on `providerEventId` +
`eventType`), and the per-user entitlement record are the consumer's.
