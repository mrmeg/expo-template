# @mrmeg/expo-purchases

Reusable RevenueCat purchases client, entitlement state, paywall gating, and
pure webhook/ledger helpers for Expo apps. One package for the pattern
NeuroSpicy and Mindmap each implemented separately.

## Ownership Boundary

Package-owned: the SDK wrapper (`configure`, identity, restore, dashboard
paywall presentation, customer-info listener), the plain `CustomerState` shape,
the entitlement store that merges device state, the server's expiry, and a
persisted snapshot, the React provider / hooks / gate, and the pure webhook
helpers (authorization, parsing, entitlement reducer, ledger-row normaliser,
Fetch handler).

App-owned: the RevenueCat dashboard (entitlements, offerings, products,
paywall design, webhook), the public and secret keys and their env names, auth
and the user id handed to RevenueCat, the paywall route and any custom paywall
UI, the backend record of `until` per user, idempotency and ledger tables, user
lookup, emails and analytics.

## Install

```sh
bun add @mrmeg/expo-purchases
```

Every peer is optional; install what the entrypoint you import needs.

| Peer | Range | Needed for |
|---|---|---|
| `react` | `>=19.2 <20` | provider, hooks, gate |
| `react-native` | `>=0.83 <0.89` | client (`Platform`), provider |
| `zustand` | `>=5 <6` | entitlement store, hooks |
| `react-native-purchases` | `>=10 <11` | native purchases (iOS / Android) |
| `react-native-purchases-ui` | `>=10 <11` | `presentPaywall` / `presentPaywallIfNeeded` |

```sh
bunx expo install react-native-purchases react-native-purchases-ui
bun add zustand
```

`react-native-purchases-ui` pins the exact `react-native-purchases` version;
install both unless you render your own paywall, in which case
`react-native-purchases` alone is enough (the `-ui` require is an optional
dependency Metro tolerates). The published type declarations do not import
either SDK (the shapes used are declared locally), so a web-only or server-only
consumer type-checks without them. They are native modules: rebuild the dev client
(`bun run ios` / `bun run android` or an EAS development build) after adding
them. `/server` needs no peer at all and runs without React, React Native, or
Node APIs.

The package is platform-split: the SDK loader ships as `sdk.js` beside
`sdk.native.js` with an extension-less specifier, so Metro resolves the native
loader on iOS/Android and the web twin (which never references either SDK) on
web. Neither SDK enters the web bundle.

Monorepo consumers use workspace resolution:

```json
{ "dependencies": { "@mrmeg/expo-purchases": "workspace:*" } }
```

## Public Imports

```ts
import {
  createPurchases,
  createEntitlementStore,
  resolveEntitlement,
  PurchasesProvider,
  useEntitlement,
  useRequireEntitlement,
  PaywallGate,
} from "@mrmeg/expo-purchases";
import {
  createWebhookHandler,
  isAuthorizedWebhook,
  parseRevenueCatWebhook,
  reduceEntitlement,
  buildLedgerRows,
  deriveSubscriptionStatus,
} from "@mrmeg/expo-purchases/server";
```

## Identifier Contract

Everything below is case sensitive and must match the RevenueCat dashboard
exactly. Decide the values once and write them into `docs/` of the app.

| Identifier | Who sets it | Where it is used |
|---|---|---|
| Entitlement (e.g. `pro`, `premium`) | RevenueCat dashboard → Entitlements | `createPurchases({ entitlement })`, `reduceEntitlement(..., { entitlement })`, `createWebhookHandler({ entitlement })`, the `requiredEntitlementIdentifier` of `presentPaywallIfNeeded` |
| Offering (e.g. `default`) | RevenueCat dashboard → Offerings, marked current | `createPurchases({ offering })`; falls back to the dashboard's current offering |
| Product ids (e.g. `app_pro_monthly`, `app_pro_annual`) | App Store Connect and Play Console, imported into RevenueCat and attached to the entitlement | Cosmetic to the backend: rows are keyed by `providerSubscriptionId` (`rc:<original_transaction_id>`). Use one id per plan across both stores |
| `app_user_id` | The app: `PurchasesProvider userId` → `Purchases.logIn` | The webhook's `event.app_user_id`; resolve the local user by it (Clerk user id, Cognito `sub`). Anonymous ids (`$RCAnonymousID:*`) cannot be mapped |
| Public SDK keys (`appl_…`, `goog_…`) | RevenueCat dashboard → API keys | `createPurchases({ iosKey, androidKey })`, read from `EXPO_PUBLIC_*` env in the app; baked into the JS bundle at build time |
| Webhook secret | You: a random string set as the webhook's Authorization header value | `createWebhookHandler({ secret })` (server env only) |

## Client Setup

Create the client and the store once at module scope. The package reads no
`process.env`; the app passes the keys in. With neither key set the app runs
unconfigured: every call answers `not_configured`, `isConfigured()` is false,
and a paywall screen can show its "coming soon" state.

```ts
// client/features/purchases/purchases.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEntitlementStore, createPurchases } from "@mrmeg/expo-purchases";

export const purchases = createPurchases({
  entitlement: "pro",
  offering: "default",
  // Direct property access: Expo inlines only statically visible EXPO_PUBLIC_* reads.
  iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  logLevel: __DEV__ ? "debug" : undefined,
  onError: (error, context) => Sentry.captureException(error, { tags: { purchases: context } }),
});

export const entitlementStore = createEntitlementStore({ storage: AsyncStorage });
```

Mount the provider inside the auth boundary, with the auth subject as
`userId` and the backend's webhook-synced expiry as `serverUntil`:

```tsx
<PurchasesProvider
  client={purchases}
  store={entitlementStore}
  userId={user?.id ?? null}
  serverUntil={entitlementQuery.data?.until ?? null}
  serverPending={entitlementQuery.isPending}
  onBlocked={(feature) => router.push({ pathname: "/paywall", params: feature ? { feature } : {} })}
>
  {children}
</PurchasesProvider>
```

`serverUntil` must be the record for `userId`: pass `serverPending` while the
query for that user is loading (or still holds the previous user's data), and
omit both when the app has no server source.

The provider, per user:

1. scopes the store to `userId` and reads that user's persisted snapshot
   (`hydrated` becomes true);
2. configures the SDK once (`sdkStatus` becomes `ready` or `unavailable`),
   attaches the customer-info listener, and calls `logIn(userId)` so
   RevenueCat's `app_user_id` is the app's user id (the result is applied even
   when null, so the device counts as having reported);
3. mirrors `serverUntil` into the store once `serverPending` is false.

When `userId` changes the store is rescoped first (every source from the
previous user dropped synchronously) and the new user logged in; when it becomes
null the SDK returns to an anonymous id and the store is cleared, including the
persisted snapshot, so entitlement never leaks between accounts. Identity calls
are serialised, so a fast sign-out → sign-in cannot leave the SDK anonymous.
Mount the provider inside the auth boundary: while `userId` is null every gate
treats the visitor as settled and not entitled.

### `PurchasesClient`

| Method | Returns | Notes |
|---|---|---|
| `isConfigured()` | boolean | A key exists for `Platform.OS`; false on web |
| `isReady()` | boolean | `configure()` succeeded this session |
| `configure(appUserId?)` | `Promise<boolean>` | Once; never throws. `logLevel` is applied first |
| `logIn(appUserId)` | `Promise<CustomerState \| null>` | Skips the SDK call when already that user |
| `logOut()` | `Promise<void>` | Only when the SDK is not already anonymous |
| `getCustomerState()` | `Promise<CustomerState \| null>` | |
| `restore()` | `RestoreOutcome` | `restored` / `none` / `failed` / `not_configured` |
| `presentPaywall({ offering?, displayCloseButton? })` | `PaywallOutcome` | RevenueCatUI dashboard paywall; offering resolved by id, else current |
| `presentPaywallIfNeeded(options?)` | `PaywallOutcome` | Adds `not_presented` when the entitlement is already active |
| `subscribe(listener)` | unsubscribe | Customer-info updates; inert before `configure` |
| `setAttributes({ $mediaSource, $campaign, … })` | `Promise<void>` | Subscriber attributes |

`PaywallOutcome` is `"purchased" | "restored" | "cancelled" | "error" |
"not_configured" | "not_presented"` for both paywall calls (`not_presented` is
what RevenueCatUI answers when the entitlement is already active, or when the
project has no paywall to show). A `purchased` or `restored` result means the
StoreKit / Play transaction completed; the listener updates the store on
device and the webhook updates the server record. Every SDK failure is
swallowed and reported to `onError(error, context)`.

`CustomerState` is plain data: `{ isActive, until, willRenew, productId,
managementUrl, appUserId, activeEntitlements }`, keyed to the configured
entitlement.

## Entitlement Store

`createEntitlementStore({ storage?, storageKeyPrefix? })` returns a zustand
store with `customer` (device), `serverUntil` (backend), `snapshot`
(persisted), `sdkStatus`, `hydrated`, `userId`, and `devOverride`
(development builds only). `storage` is any AsyncStorage-shaped object
(`getItem` / `setItem` / `removeItem`); without it nothing persists and
`hydrated` is immediate.

`resolveEntitlement(sources, now?, entitlement?)` decides access in trust order:

1. `devOverride` (only when `__DEV__`);
2. device: `customer.isActive`;
3. server: `serverUntil > now`;
4. snapshot: only while the device has given no state, when it says active with
   a future (or no) expiry, and when the server has not reported — or reported
   an expired term while the device can still answer (a lagging backend must
   not lock a renewed subscriber out for the logIn round-trip; on web the
   server verdict stands);
5. none.

`until` is the latest known expiry across the sources consulted; a lifetime
grant (device `until: null`, or the server's `LIFETIME_UNTIL` sentinel) reads
as `null`. The snapshot is written on every live update, revocations included,
so a cold start can show the paywall without waiting on the network; it is
scoped by user id and `ENTITLEMENT_SNAPSHOT_VERSION`, a wrong user or version
reads as missing, and nothing is written for the signed-out scope.

`useEntitlement().settled` is the signal to act on: the store is scoped to the
current user, its snapshot was read (`hydrated`), and either the device has
reported (a state, or "nothing"), a usable snapshot exists (inactive, or active
with a future or no expiry), the server granted (`serverUntil > now`), the SDK
is unavailable (web, key-less build) and the server has reported, or there is
no user. Hold the splash screen and any automatic paywall until `settled` is
true; `hydrated` alone only says the snapshot read finished. A time-based grant
is re-evaluated when its `until` passes, so an idle screen locks on expiry.

The snapshot is written only once the device has answered (or the SDK is
unavailable), so a server value the app still held from a previous user is
never persisted under the new user's key.

A gate on another entitlement than the configured one
(`useEntitlement("teams")`, `<PaywallGate entitlement="teams">`) checks the
device's `activeEntitlements` only; the server and snapshot know the
configured entitlement alone.

## Gating

```tsx
const { isEntitled, until, source, isReady, presentPaywall, restore } = useEntitlement();

const requireExport = useRequireEntitlement("export");
async function onExport() {
  if (!requireExport()) return; // provider onBlocked("export") pushed the paywall
  await exportGraph();
}
// Before `settled`, requireExport() returns false without opening the paywall;
// disable the control on `!settled` if the first second matters.

<PaywallGate feature="media" fallback={<UpsellCard feature="media" />}>
  <MediaPicker />
</PaywallGate>
```

`PaywallGate` renders `children` when entitled, otherwise `fallback` (nothing
by default) and reports the block once per lock through its own `onBlocked`
or the provider's. It reports only once the verdict is `settled`, so a paying
user never sees the paywall flash on a cold start, a reinstall, or an account
switch. Both the hook and the gate accept `feature` so the paywall can explain
why it opened.

On the paywall screen call `presentPaywall()` for the RevenueCat dashboard
paywall, or build your own screen from the app's UI kit and call
`Purchases.purchasePackage` through your own code; `restore()` backs the
"Restore purchases" affordance both stores require.

## Server Webhook

`/server` is pure: authorize, parse, decide, and hand plain rows to the
consumer's storage. It is the same code for an Expo API route, Express, a
Convex `httpAction`, Next, or a Cloudflare Worker.

```ts
// app/api/revenuecat/webhook+api.ts (Expo) — or wrap the handler for Express / Convex
import {
  buildLedgerRows,
  createWebhookHandler,
  reduceEntitlement,
} from "@mrmeg/expo-purchases/server";

export const POST = createWebhookHandler({
  secret: process.env.REVENUECAT_WEBHOOK_SECRET,
  entitlement: "pro",
  onError: (error, context) => logger.error("revenuecat", context, error),
  onEvent: async (event) => {
    if (await webhookEvents.seen(`rc_${event.id}`)) return { duplicate: true };
    const user = await users.findByAuthSubject(event.appUserId);
    if (!user) return { applied: false }; // 200: RevenueCat must not retry forever
    const previouslyExpired = event.type === "INITIAL_PURCHASE" && (await ledger.hasExpired(user.id));
    await ledger.insertIgnoringConflicts(buildLedgerRows(event, { userId: user.id, previouslyExpired }));
    const reduction = reduceEntitlement(user.entitlement, event, { entitlement: "pro" });
    if (reduction.action === "set") await users.saveEntitlement(user.id, reduction.next);
    await webhookEvents.record(`rc_${event.id}`, event.type);
    return { applied: reduction.action === "set" };
  },
});
```

| Response | When |
|---|---|
| `500 webhook_secret_not_configured` | `secret` is empty |
| `401 unauthorized` | Authorization header missing or not the secret (bare or `Bearer <secret>`, constant-time) |
| `400 invalid_body` / `400 missing_event` | Not JSON, or no `event.id` / `event.type` / `event.event_timestamp_ms` |
| `200 { ok: true, ignored: "entitlement" }` | `entitlement` is set and the event names other entitlements only |
| `200 { ok: true, ...result }` | `onEvent` returned (its object is merged in) |
| `500 handler_failed` | `onEvent` threw; RevenueCat retries |

### Event → ledger rows (`buildLedgerRows`)

| RevenueCat event | Ledger rows | Notes |
|---|---|---|
| `INITIAL_PURCHASE` | `trial_started` (amount 0) when `period_type = TRIAL`, else `purchased`; plus `reactivated` when `previouslyExpired` | |
| `NON_RENEWING_PURCHASE` | `purchased` | One-time purchase; revenue like any other |
| `RENEWAL` | `trial_converted` when `is_trial_conversion`, else `renewed` | |
| `CANCELLATION` | `cancel_scheduled`; plus `refunded` when `cancel_reason = CUSTOMER_SUPPORT` and `expiration_at_ms` is absent or `<= event_timestamp_ms` | RevenueCat has no REFUND type |
| `UNCANCELLATION` | `uncanceled` | |
| `EXPIRATION` | `expired` | |
| `BILLING_ISSUE` | `billing_issue` | |
| `PRODUCT_CHANGE` | `product_changed` | |
| `REFUND_REVERSED` | `refund_reversed` | App Store undoing a refund; access restored from `expiration_at_ms` |
| anything else (`TEST`, `TRANSFER`, `SUBSCRIPTION_PAUSED`, `SUBSCRIPTION_EXTENDED`, `TEMPORARY_ENTITLEMENT_GRANT`, …) | none | |

Row shape: `{ userId, provider: "revenuecat", eventType, providerEventId,
providerEventType, providerSubscriptionId, productId, store, periodType,
amountCents, currency: "usd", renewalNumber, cancelReason, environment,
occurredAt, payload }`. `store`, `periodType`, and `environment` are
lowercased; `amountCents` is RevenueCat's USD `price` rounded to cents;
`payload` is the event minus `subscriber_attributes`; `occurredAt` is
`event_timestamp_ms`. Make (`providerEventId`, `eventType`) unique in the
ledger table and insert with conflicts ignored so a replayed delivery cannot
double-count.

### Current state (`reduceEntitlement`, `deriveSubscriptionStatus`)

`reduceEntitlement(current, event, { entitlement })` keeps one record per user
and entitlement, `{ until, productId, updatedAt }`, where `until` is null for
"no access recorded" and `LIFETIME_UNTIL` (exported; the largest `Date` value)
for a grant with no expiration. Webhook events are per product, so the reducer
never lets one product's event shorten what another granted:

- grants (`INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`,
  `NON_RENEWING_PURCHASE`, `SUBSCRIPTION_EXTENDED`,
  `TEMPORARY_ENTITLEMENT_GRANT`, `REFUND_REVERSED`) set `until` to the later of
  the current value and the event's expiration — monotonic, so a late-delivered
  grant is still applied;
- `EXPIRATION` sets `until` to the event's expiration (else the event time)
  unless the record already runs longer, except when `expiration_reason` is
  `CUSTOMER_SUPPORT` or `DEVELOPER_INITIATED` (deliberate early revocations
  always cut);
- a refund `CANCELLATION` (`isRefundCancellation`: `CUSTOMER_SUPPORT` with the
  expiration moved back, or absent for a refunded one-time purchase) moves
  `until` back to the event's expiration (else the event time)
  unconditionally, so access ends without waiting for an `EXPIRATION` that, for
  a one-time purchase, never comes. This is the one event that can cut a
  longer term another product granted: key records per product if you sell
  overlapping products on one entitlement;
- everything else is `{ action: "skip", reason }`: other entitlements
  (`not-entitlement`), out-of-order revocations (`stale`: older than
  `current.updatedAt`), and events that change nothing (`no-op`: ordinary
  `CANCELLATION`, `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED`, `TEST`).

Store `next.until` as the user's `until` and pass it to `PurchasesProvider
serverUntil` as is; `resolveEntitlement` treats `LIFETIME_UNTIL` as "never
expires". `TRANSFER` moves purchases between app user ids: revoke each
`transferredFrom` user with `revokedByTransfer(event)`; the receiving side
refreshes from the SDK and the next event; `reduceEntitlement` skips `TRANSFER`
(it carries no entitlement ids).

`deriveSubscriptionStatus(event)` maps to `trialing | active | past_due |
canceled` for consumers that keep a current-state subscriptions row per
(user, provider) with a `last_webhook_at` monotonicity guard.

## Setup Checklist (human)

Seven steps, done once per app. Nothing in the package works end to end until
step 4 (client) and step 5 (server) are complete.

1. **App Store Connect**: accept the Paid Apps agreement; create a
   subscription group and one auto-renewable subscription per plan (product
   ids from the identifier contract), each with its introductory offer (free
   trial) if any; add a sandbox tester; generate an In-App Purchase key (Users
   and Access → Integrations → In-App Purchase) for RevenueCat.
2. **Google Play Console**: set up the payments profile; create each
   subscription with its base plan (monthly / yearly) and free-trial offer;
   link a service account with financial permissions to RevenueCat; enable
   Real-time Developer Notifications; add a license tester.
3. **RevenueCat**: create the project; add the App Store and Play Store apps
   (bundle id / package name); import the products per store; create the
   entitlement and attach every store product; create the offering with its
   packages and mark it current; design the paywall (template → add the
   Terms of Use and Privacy Policy footer links → publish).
4. **Keys**: copy the public SDK keys into `.env` and the EAS environment as
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   (or the names your app reads). They are baked into the bundle: a key change
   needs a rebuild, not an OTA update.
5. **Webhook**: generate a random secret, set it on the server (for example
   `REVENUECAT_WEBHOOK_SECRET`), add a RevenueCat webhook pointing at the
   route (`/api/revenuecat/webhook`, or `https://<deployment>.convex.site/…`)
   with that value in the Authorization header field, for Sandbox and
   Production events. Send the dashboard's test event: the route answers
   `200 { ok: true, ... }` (a TEST event has no real user to update).
6. **Rebuild the dev client** (`bun run ios` / `bun run android` or an EAS
   development build): both SDKs are native modules.
7. **Sandbox test**: purchase with a sandbox / license-tester account, confirm
   the entitlement on device and the server record from the webhook, restore
   on a second device, cancel, and let a sandbox renewal expire.

## Store Review Checklist

Apple rejected NeuroSpicy under Guideline 3.1.2(c) for a paywall without
functional Terms of Use and Privacy Policy links; every item below is cheap
compared with a resubmission.

- [ ] The paywall shows working **Terms of Use** and **Privacy Policy** links
      before purchase. For the RevenueCat dashboard paywall, set both footer
      links in the paywall template and publish it (a project with no published
      paywall falls back to a generic sheet without legal links). For a custom
      paywall, render both links yourself.
- [ ] The paywall states the price, billing period, trial length, and that the
      subscription renews automatically until cancelled.
- [ ] App Store Connect → App Information: Privacy Policy URL set; Terms of Use
      (EULA) either left as Apple's standard EULA or a custom URL whose terms
      include Apple's required boilerplate.
- [ ] App Review notes name the demo / sandbox account and say where the Terms
      and Privacy links are shown; attach a screenshot of the paywall.
- [ ] Both stores expose a **Restore purchases** affordance (`restore()`).
- [ ] Manage-subscription entry point opens `CustomerState.managementUrl` or
      the store's subscription settings.
- [ ] A build without a platform key never shows a purchase button that can
      fail: check `isConfigured()` / `isReady()` and show the "coming soon"
      state instead.
- [ ] Sandbox purchase, restore, and cancellation verified on a release build
      of each platform before submission.

## Validation

```sh
bun run packages:peer-check
bun run purchases:typecheck
bun run purchases:test
bun run purchases:build
bun run purchases:pack
bun run purchases:consumer-smoke
```

`purchases:consumer-smoke` installs the packed tarball into two clean
fixtures: a peer-free one proving `/server` loads and parses a webhook without
React Native, zustand, or either RevenueCat SDK present, and a fully
provisioned one that type-checks every documented entrypoint. It also verifies
export-map files and that the installed package ships `README.md`,
`CHANGELOG.md`, `LLM_USAGE.md`, `llms.txt`, and `llms-full.md`. CI installs
packed consumers against Expo 57 and 58.

## Package Release

```sh
bun run purchases:release -- --patch [--publish]
```

Accepts `--patch`, `--minor`, `--major`, or an exact `x.y.z`; the default bump
is patch. It updates `packages/purchases/package.json` and `bun.lock`, then
runs `packages:peer-check` and the `typecheck`, `test`, `build`, `pack`, and
`consumer-smoke` gates. Without `--publish` it stops after the gates. A clean
working tree is required unless `--allow-dirty` is passed.

## GitHub Publishing

The `Publish Purchases Package` workflow
(`.github/workflows/publish-purchases.yml`) is `workflow_dispatch` only: it
bumps `patch`, `minor`, `major`, or an exact version, runs
`packages:peer-check` and the purchases gates, publishes with
`npm publish --access public`, and commits the bump back to the selected
branch. It has no `push` trigger yet because the package has never been
published, and npm has no settings page for trusted publishing until it
exists.

First publish: add a repository secret `NPM_TOKEN` with publish access to the
`@mrmeg` scope, run the workflow manually with `version=0.1.0` and
`ref=main` (or `bun run purchases:release -- 0.1.0 --publish` locally after
`npm login`). Then configure npm trusted publishing for owner `mrmeg`,
repository `expo-template`, workflow filename `publish-purchases.yml`, and add
the same `push` block `publish-media.yml` has so later version bumps on `main`
publish automatically.
