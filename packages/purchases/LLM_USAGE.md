# LLM Usage: @mrmeg/expo-purchases

## Imports

| Subpath | Contents |
|---|---|
| `@mrmeg/expo-purchases` | `createPurchases`, `createEntitlementStore`, `resolveEntitlement`, `PurchasesProvider`, `useEntitlement`, `useRequireEntitlement`, `PaywallGate`, `toCustomerState`, types |
| `/server` | `isAuthorizedWebhook`, `parseRevenueCatWebhook`, `reduceEntitlement`, `revokedByTransfer`, `buildLedgerRows`, `deriveSubscriptionStatus`, `isRefundCancellation`, `createWebhookHandler`, `LEDGER_EVENT_TYPES` |

`/server` imports nothing from React, React Native, Node, or the RevenueCat
SDKs: use it from Expo API routes, Express, Convex `httpAction`, Next, or a
Worker. Never import the root into server code.

Peers are all optional. Native apps install `react-native-purchases` and
`react-native-purchases-ui` at the same version (`>=10 <11`) and `zustand`
(`>=5 <6`); web and server consumers install none. The SDK loader is platform
split (`sdk.js` / `sdk.native.js`, extension-less specifier), so a native
bundler needs Metro-style platform resolution.

## Client

```ts
const purchases = createPurchases({
  entitlement: "pro",              // RevenueCat entitlement identifier
  offering: "default",             // optional; dashboard "current" otherwise
  iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  onError: (error, context) => Sentry.captureException(error, { tags: { context } }),
});
const entitlementStore = createEntitlementStore({ storage: AsyncStorage });
```

Read `process.env.EXPO_PUBLIC_*` with direct property access in the app (Expo
inlines only statically visible references); the package reads no env. Create
both once at module scope.

Mount once, inside the auth boundary:

```tsx
<PurchasesProvider
  client={purchases}
  store={entitlementStore}
  userId={user?.id ?? null}                 // RevenueCat app_user_id
  serverUntil={entitlement?.until ?? null}  // from the app's webhook-backed record
  onBlocked={(feature) => router.push({ pathname: "/paywall", params: feature ? { feature } : {} })}
>
```

The provider configures the SDK only while `userId` is set, logs the user in,
attaches the customer-info listener, mirrors `serverUntil`, and on sign-out
returns the SDK to anonymous and deletes the persisted snapshot.

Read access with `useEntitlement()` → `{ isEntitled, until, source, hydrated,
isConfigured, isReady, customer, restore, presentPaywall,
presentPaywallIfNeeded }`. Hold the splash screen until `hydrated`. Gate an
action with `const requireExport = useRequireEntitlement("export")` and
`if (!requireExport()) return;`. Gate a subtree with
`<PaywallGate feature="export" fallback={<Upsell />}>`. `presentPaywall()`
resolves `"purchased" | "restored" | "cancelled" | "error" | "not_configured"`;
`presentPaywallIfNeeded()` adds `"not_presented"`. After `purchased`/`restored`
the listener updates the store; the webhook updates the server record.

`resolveEntitlement` order: dev override (development builds only), device
`customer.isActive`, `serverUntil > now`, then the persisted snapshot only while
neither live source has reported this session. A gate on another entitlement
(`useEntitlement("teams")`, `<PaywallGate entitlement="teams">`) checks the
device's active list only.

## Server

```ts
export const POST = createWebhookHandler({
  secret: process.env.REVENUECAT_WEBHOOK_SECRET,
  entitlement: "pro",
  onEvent: async (event) => {
    if (await alreadyProcessed(event.id)) return { duplicate: true };
    const user = await findUserByAuthSubject(event.appUserId);   // app_user_id
    if (!user) return { applied: false };
    const rows = buildLedgerRows(event, { userId: user.id, previouslyExpired: await hadExpired(user.id) });
    await insertLedgerIgnoringConflicts(rows);                    // unique (providerEventId, eventType)
    const next = reduceEntitlement(user.entitlement, event, { entitlement: "pro" });
    if (next.action === "set") await saveEntitlement(user.id, next.next);
    return { applied: next.action === "set" };
  },
});
```

`createWebhookHandler` answers 500 without a secret, 401 on a bad
`Authorization` header (bare secret or `Bearer <secret>`, constant-time), 400 on
a malformed body, 200 after `onEvent` (its returned object is merged into
`{ ok: true }`), and 500 when `onEvent` throws so RevenueCat retries. Events for
other entitlements are acknowledged without reaching `onEvent`. Anonymous
`$RCAnonymousID:*` app user ids cannot be mapped; ignore them.

Ledger vocabulary (`LEDGER_EVENT_TYPES`): `trial_started`, `trial_converted`,
`purchased`, `renewed`, `cancel_scheduled`, `uncanceled`, `expired`,
`billing_issue`, `refunded`, `refund_reversed`, `product_changed`,
`reactivated`. There is no REFUND webhook type: a refund is a CANCELLATION with
`cancel_reason: CUSTOMER_SUPPORT` and the expiration moved back
(`isRefundCancellation`). `amountCents` is RevenueCat's USD price in cents,
pinned to 0 for `trial_started`. `occurredAt` is `event_timestamp_ms`. Rows are
camelCase and JSON-serialisable; map to your table's columns.

## Identifiers

Entitlement, offering, and product identifiers are case sensitive and must match
the RevenueCat dashboard exactly. `app_user_id` is the app's auth subject
(Clerk user id, Cognito `sub`). The server keys the subscription row off
`providerSubscriptionId` (`rc:<original_transaction_id>`), so store product ids
are cosmetic to the backend. See README "Identifier Contract", "Setup Checklist
(human)", and "Store Review Checklist".
