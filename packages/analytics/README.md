# @mrmeg/expo-analytics

First-party analytics for Expo and web apps that you host yourself. The trackers
send events to an endpoint your server mounts, the events land in tables the
package installs in your own Postgres, and the server computes product,
retention, funnel, acquisition, web and revenue reports from them, served as
JSON, CSV and a built-in dashboard.

What it is:

- An event tracker for the browser (`./web`), React Native (`./native`) and any
  other runtime (`.`), with typed events, batching, retries and a consent switch.
- An ingest endpoint and a host-side API (`./server`): `track`, `identify`,
  revenue ledger writes, tracked redirect links, pruning, and the reports.
- Seven tables in a database you already run, installed and removed by one call
  or one CLI command, with nothing referencing your own tables.
- Pure metric functions, the report types, CSV and formatting (`./metrics`), so a
  host can render the figures in its own admin screen.

What it is not:

- Not a hosted service. Nothing leaves your infrastructure; there is no account,
  key or third-party script.
- Not a session-replay, heatmap, A/B testing or feature-flag product.
- Not a data warehouse. The reports are fixed definitions over these tables
  (documented below); for anything else, query the tables yourself.

## Contents

- [Install and remove](#install-and-remove)
- [Server setup](#server-setup)
- [Client setup](#client-setup)
- [Server-side events and users](#server-side-events-and-users)
- [Revenue](#revenue)
- [Tracked links](#tracked-links)
- [Metric definitions](#metric-definitions)
- [Privacy](#privacy)
- [Dashboard and query API](#dashboard-and-query-api)
- [Operations](#operations)

## Install and remove

```bash
bun add @mrmeg/expo-analytics      # or npm install / yarn add
```

The package ships no Postgres driver. The server side takes a client you already
have, through `fromPostgresJs` (the `postgres` package) or `fromPg` (the `pg`
package). `react-native` is an optional peer, needed only by
`@mrmeg/expo-analytics/native`. Postgres 13 or later (the tables use
`gen_random_uuid()`).

| Import | Use it in | Contents |
|---|---|---|
| `@mrmeg/expo-analytics` | any runtime | `createTracker` (the core, transport and storage injected), wire contract constants and types |
| `@mrmeg/expo-analytics/web` | browsers | `createWebTracker` |
| `@mrmeg/expo-analytics/native` | React Native | `createNativeTracker` |
| `@mrmeg/expo-analytics/metrics` | anywhere (no I/O, no Node APIs) | report types, the pure metric functions, `resolveDateRange`, `toCsv`, formatting |
| `@mrmeg/expo-analytics/server` | Node or Bun (uses `node:crypto` and `Buffer`) | `createAnalyticsServer`, `toNodeHandler`, `install` / `uninstall` / `status`, `fromPostgresJs` / `fromPg`, the report functions |

Never import `./server` into an app bundle.

### Where the tables go

Two placements, chosen by the `schema` and `prefix` options (the same options on
the server, the CLI, and the programmatic functions):

- **Prefixed tables in the app's existing schema (default).** `schema` unset:
  the tables are created unqualified, so they land wherever the connection's
  `search_path` points, named `analytics_events`, `analytics_users`, and so on.
  This is the placement for a shared database where each app has one schema and
  one role that cannot create schemas.
- **A dedicated schema.** `schema: "analytics"` qualifies every name
  (`"analytics"."analytics_events"`). Install creates the schema when the role
  may; when it may not, install fails and says to pre-create it
  (`create schema "analytics" authorization <role>`).

`prefix` (default `analytics_`) is lowercase letters, digits and underscores, at
most 20 characters. `schema` is lowercase letters, digits and underscores. Both
are validated before any SQL runs; they are the only values the package ever
interpolates into SQL text.

### What install creates

Seven tables, each named `<prefix><name>`, and their indexes (named
`<prefix><suffix>_idx`):

| Table | Holds |
|---|---|
| `analytics_migrations` | Applied migration versions, and whether install created the schema |
| `analytics_events` | One row per event; `id` is client-generated, so a retried batch is dropped on conflict |
| `analytics_sessions` | One row per visit, maintained at ingest: entry and exit path, pageviews, custom events, referrer host, UTM tags, device, browser, OS, country |
| `analytics_users` | One row per signed-in user the server has seen: first and last seen, `excluded`, traits, first-touch acquisition, resolved `channel` |
| `analytics_link_clicks` | One row per hit on a tracked link (`/go/:channel`) |
| `analytics_revenue_events` | Append-only money ledger: subscriptions and one-time purchases from any provider |
| `analytics_salts` | Daily salts for cookieless visitor ids; only today's row exists |

No foreign key references a host table: `user_id` is your user id stored as
text. Every row carries `app_id`, so several apps can share one set of tables.

Uninstall drops exactly these seven tables (in reverse creation order, with
`restrict`), and, in the dedicated-schema placement, the schema too if install
created it and it is then empty. Nothing else is touched. Ownership is proven
by a stamp, not by name: install writes the table comment `expo-analytics` on
each table it creates, and uninstall drops only tables carrying it. A table of
yours that happens to share a name (your own `analytics_users`, say) makes
install refuse with nothing changed, and uninstall reports it under `skipped`
and leaves it alone. If one of your own
views or foreign keys depends on a table, uninstall fails and names it; pass
`cascade` to drop those dependents as well.

### CLI

```bash
npx expo-analytics install --database-url "$DATABASE_URL"
npx expo-analytics status
npx expo-analytics uninstall                 # prints what would be dropped, exits 1
npx expo-analytics uninstall --yes           # drops them
```

| Option | Meaning |
|---|---|
| `--database-url <url>` | Postgres URL (default: `$DATABASE_URL`) |
| `--schema <name>` | Dedicated schema (default: the connection's `search_path`) |
| `--prefix <prefix>` | Table name prefix (default: `analytics_`) |
| `--cascade` | `uninstall`: also drop objects that depend on the tables |
| `--yes`, `-y` | `uninstall`: actually drop |

The CLI loads `postgres`, then `pg`, from the project in the working directory,
so run it from a project that has one installed. Exit codes: 0 ok, 1 failed or
refused, 2 usage error.

### Programmatic

```ts
import { fromPostgresJs, install, status, uninstall } from "@mrmeg/expo-analytics/server";
import postgres from "postgres";

const sql = fromPostgresJs(postgres(process.env.DATABASE_URL!));

await install(sql);                                  // { applied: [1], version: 1, createdSchema: false }
await install(sql, { schema: "analytics" });         // the dedicated placement
await status(sql);                                   // { installed, version, latest, pending, tables }
await uninstall(sql, {}, { cascade: false });        // { dropped: [...], droppedSchema }
```

The server object has the same three as methods (`server.install()`,
`server.uninstall()`, `server.status()`), bound to its own placement. Install
runs in one transaction under an advisory lock keyed on the placement and
applies only the migrations not yet recorded, so it is safe to call on every
boot from every instance.

## Server setup

```ts
// server/analytics.ts
import { createAnalyticsServer, fromPostgresJs } from "@mrmeg/expo-analytics/server";
import postgres from "postgres";

export const analytics = createAnalyticsServer({
  sql: fromPostgresJs(postgres(process.env.DATABASE_URL!)),
  appId: "my-app",
  // The signed-in user for a request, or null. Your auth, not the client's word.
  resolveUserId: async (request) => (await verifySession(request))?.userId ?? null,
  // Opens the dashboard and the query API. Without it they answer 404 to everyone.
  isAdmin: async (request) => (await verifySession(request))?.role === "admin",
  metrics: {
    timezone: "America/New_York",
    activation: { event: "first_project_created", withinDays: 7 },
    funnels: [
      { key: "onboarding", name: "Onboarding", steps: ["signup_completed", "first_project_created"], windowDays: 7 },
    ],
  },
});

await analytics.install();
```

With `pg` instead:

```ts
import { createAnalyticsServer, fromPg } from "@mrmeg/expo-analytics/server";
import { Pool } from "pg";

export const analytics = createAnalyticsServer({
  sql: fromPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  appId: "my-app",
});
```

`verifySession` stands for your own auth. `handle(request)` returns the response
for any path under `basePath`, or `null` for every other path, and never throws.

### Configuration

| Option | Default | Meaning |
|---|---|---|
| `sql` | required | A `SqlClient`: `fromPostgresJs(client)` or `fromPg(pool)` |
| `appId` | required | 1 to 64 of letters, digits, `.`, `_`, `:`, `-`. Stamped on every row |
| `schema`, `prefix` | unset, `analytics_` | Table placement (above) |
| `basePath` | `/analytics` | Where every route is mounted |
| `resolveUserId` | none (every event anonymous) | `(request) => string \| null`. Its throw is reported and the events kept, unattributed |
| `isAdmin` | none (closed) | `(request) => boolean`. Gates the dashboard and the query API |
| `allowedOrigins` | none (same origin only) | Origins allowed to POST events cross-origin, or `"*"` |
| `clientIp` | first `x-forwarded-for` hop, then `x-real-ip` | The visitor's IP, for the cookieless hash only |
| `country` | the `cf-ipcountry` header | ISO 3166 alpha-2 country, stored on the session |
| `links` | none (`/go/*` answers 404) | Tracked links (below) |
| `metrics` | see below | How reports cut the figures |
| `now` | `() => new Date()` | Clock |
| `onError` | `console.error` | `(error, where) => void` for errors the server swallows |

`metrics` (`MetricsConfig`), validated when the server is created:

| Field | Default | Meaning |
|---|---|---|
| `timezone` | `"UTC"` | IANA zone every day is cut in |
| `activation` | none | `{ event, withinDays }` (`withinDays` default 7): the event that marks a user activated |
| `activeEvents` | every event except `$session_end` | Event names that count as activity |
| `retentionDays` | `[1, 7, 30, 90]` | The N values of the headline retention figures |
| `funnels` | `[]` | `{ key, name, steps, windowDays }` (`windowDays` default 7) |

The client is trusted for nothing about identity. `user_id` never travels on the
wire; `resolveUserId` decides it from the request (a session cookie, a bearer
token). Requests without an `Origin` header (native apps, servers) and
same-origin requests may always post; a cross-origin browser request only when
its origin is listed in `allowedOrigins`. A listed origin gets credentials so
its cookie reaches `resolveUserId`. A request admitted only by `"*"` is never
attributed: `resolveUserId` is not called for it, because a browser still sends
the visitor's cookies on such a request and any site could otherwise write
events as a signed-in user. Use `"*"` only for anonymous traffic.

Behind a proxy that does not set `x-forwarded-for` or `x-real-ip`, or with no
proxy at all, pass `clientIp`: without an IP, every cookieless visitor with the
same user agent hashes to the same id.

### Express 5

```ts
import express from "express";
import { toNodeHandler } from "@mrmeg/expo-analytics/server";
import { analytics } from "./analytics";

const app = express();
app.use(toNodeHandler(analytics));   // before or after express.json(); both work
```

`toNodeHandler` passes every request outside `basePath` to `next()` without
reading its body. It reuses a body a parser already consumed, caps the body at
1 MiB, and also works on Express 4 and a bare `node:http` server.

### Expo Router API routes

A catch-all route under the base path handles everything below it. `[...path]`
needs at least one segment, so the dashboard at `/analytics` itself needs an
index route too. Both call one handler:

```ts
// server/analytics.ts, next to createAnalyticsServer
export async function handleAnalytics(request: Request): Promise<Response> {
  return (await analytics.handle(request)) ?? new Response("Not found", { status: 404 });
}
```

```ts
// app/analytics/[...path]+api.ts
import { handleAnalytics } from "@/server/analytics";

export const GET = handleAnalytics;
export const HEAD = handleAnalytics;
export const POST = handleAnalytics;
export const OPTIONS = handleAnalytics;
```

```ts
// app/analytics/index+api.ts
import { handleAnalytics } from "@/server/analytics";

export const GET = handleAnalytics;
```

A screen route at `/analytics` would collide with this; use `basePath` to mount
elsewhere and move the route files to match.

### Next.js route handler

```ts
// app/analytics/[[...path]]/route.ts
import { handleAnalytics } from "@/server/analytics";   // as above

export const runtime = "nodejs";   // the server uses node:crypto and Buffer

export { handleAnalytics as GET, handleAnalytics as HEAD, handleAnalytics as POST, handleAnalytics as OPTIONS };
```

The optional catch-all `[[...path]]` matches `/analytics` itself as well.

### Routes

All under `basePath`:

| Route | Access |
|---|---|
| `POST /e`, `OPTIONS /e` | public: event ingest and its CORS preflight |
| `GET /go/:channel`, `HEAD /go/:channel` | public, mounted only with `links` |
| `GET /`, `GET /assets/dashboard.js`, `GET /assets/dashboard.css` | admin: the dashboard |
| `GET /api/meta`, `GET /api/<report>`, `GET /api/events` | admin: the query API |

An admin route answers 404 unless `isAdmin` returns true for the request, so
its existence is not disclosed. **The dashboard and the query API are closed
until you supply `isAdmin`.**

## Client setup

### Web

```ts
import { createWebTracker } from "@mrmeg/expo-analytics/web";
import type { AppEvents } from "./events";

export const tracker = createWebTracker<AppEvents>({
  endpoint: "https://app.example.com/analytics/e",
});
```

Cookieless by default: no id, no storage, nothing written to the browser. Events
carry no anonymous or session id; the server derives both from a hash of the
request (see [Privacy](#privacy)), so a visitor is one visitor within a UTC day
and a new one the next.

`persist: true` opts into an anonymous id, a queue, first-touch acquisition and
30-minute idle sessions kept in `localStorage` (keys under `storageKey`, default
`expo-analytics`), so a visitor is recognised across days.

Automatic pageviews (`autoPageviews`, default true): a `$pageview` on creation,
on each `history.pushState` / `replaceState` that changes the path, and on
`popstate`. Paths are sent without query string or fragment. The landing URL's
`utm_*`, `fbclid` / `gclid` / `ttclid` / `msclkid` and `link_click` parameters,
and an off-site `document.referrer`, become first-touch acquisition. When the
page is hidden or unloads, the queue goes out as one request of at most 60,000 bytes through
`navigator.sendBeacon` (or `fetch` with `keepalive` when `headers` is set, since
a beacon cannot carry headers).

| Option | Default | Meaning |
|---|---|---|
| `endpoint` | required | URL of `POST <basePath>/e` |
| `persist` | `false` | Anonymous id and sessions in `localStorage` |
| `autoPageviews` | `true` | `$pageview` on load and History navigation |
| `respectDoNotTrack` | `false` | An inert tracker when the browser sends Do Not Track |
| `linkClickParam` | `"link_click"` | Landing parameter carrying the tracked-link click id |
| `headers` | none | `() => headers` per request, e.g. an auth token |

Outside a browser (server rendering, tests) `createWebTracker` returns an inert
tracker with the same interface; importing the module touches no globals.
`tracker.destroy()` restores the History methods and removes the listeners.

### React Native

```ts
// client/analytics.native.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNativeTracker } from "@mrmeg/expo-analytics/native";
import type { AppEvents } from "./events";

export const tracker = createNativeTracker<AppEvents>({
  endpoint: "https://app.example.com/analytics/e",
  storage: AsyncStorage,
  appVersion: "1.4.0",
  headers: async () => {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
```

`storage` is any AsyncStorage-compatible store (`getItem`, `setItem`,
`removeItem`). It keeps the anonymous id, the unsent queue and first-touch
acquisition across launches; without it they last one launch. `platform`
defaults from `Platform.OS`.

Sessions follow `AppState`: one opens when the app is in the foreground
(`$session_start`), the queue is flushed when it goes to the background, and a
background gap longer than `sessionIdleMs` (default 30 minutes) ends the session
at the moment the app left (`$session_end` with `props.duration_ms`). iOS
`inactive` (Control Center, the app switcher) is not a departure.
`tracker.destroy()` removes the `AppState` subscription.

Shared options (all three trackers):

| Option | Default | Meaning |
|---|---|---|
| `flushIntervalMs` | `30000` | Timed flush |
| `flushAt` | `20` | Queue length that triggers a flush |
| `maxQueue` | `1000` | Oldest events are dropped beyond this |
| `enabled` | `true` | Consent: false queues, stores and sends nothing |
| `transport` | global `fetch` | `(request) => Promise<{ status }>` |
| `onError` | none | Every error the tracker swallows |

Batches hold at most 100 events. A 2xx removes them from the queue; a 4xx other
than 408 and 429 drops them (the server would refuse them every time); anything
else, or a network error, retries with backoff from 1 second doubling to 5
minutes. No tracker method throws.

### Typed events

```ts
// client/events.ts
export type AppEvents = {
  signup_completed: { method: "email" | "apple" };
  paywall_viewed: { placement: string };
  onboarding_skipped: undefined;
};
```

```ts
tracker.track("signup_completed", { method: "apple" });
tracker.track("onboarding_skipped");
tracker.track("signup_completed");              // type error: props required
tracker.track("signup_complete", {});           // type error: unknown event
```

The map and each props type must be `type` aliases, not `interface`s: the
trackers constrain the map to `Record<string, Record<string, unknown> |
undefined>`, and an interface has no implicit index signature, so it does not
satisfy that constraint. An event whose props type includes `undefined` takes
them optionally.

Event names are lowercase snake case (`^[a-z][a-z0-9_]*$`, at most 64
characters). A name the tracker refuses is dropped and reported to `onError`; the
server refuses it too. The `$` prefix is reserved: `$pageview`, `$screen`,
`$session_start` and `$session_end` are the package's own. Props are a flat JSON
object of at most 50 keys and 4 KB; larger props are replaced with
`{ _truncated: true }` and the event is kept.

### Screens in Expo Router

On native, record each route as a screen. On web, `createWebTracker` already
records pageviews from the History API, so keep this effect native-only (the
`.native.ts` file next to a web `analytics.ts`, as above, does that).

```tsx
// client/useScreenTracking.native.ts
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { tracker } from "./analytics";

export function useScreenTracking() {
  const pathname = usePathname();
  useEffect(() => {
    tracker.screen(pathname);
  }, [pathname]);
}
```

Call it once in the root layout. `screen(name)` emits `$screen` and makes `name`
the `path` of the events that follow.

### Consent and sign-out

```ts
tracker.setEnabled(false);   // stops; drops the queue (and the stored queue)
tracker.setEnabled(true);    // resumes
```

Start with `enabled: false` when consent comes first. While disabled, landing
acquisition is kept in memory only, so a later opt-in still sends it.

```ts
await tracker.reset();       // then drop the auth token
```

`reset()` ends the session, clears acquisition and flushes the queue, keeping
the anonymous id. Call it before the token goes away: the flush reads
`headers()` at once, so the signed-out user's last events are still attributed
to them. On native a fresh session opens after the flush.

### Acquisition

`tracker.setAcquisition({ self_reported_source: "tiktok" })` records the user's
answer to "where did you hear about us?" (or any `WireAcquisition` field). The
tracker repeats acquisition on every batch; the server fills only fields that
are still empty on the user row, so repeating is harmless. Call
`tracker.clearAcquisition()` once the user has signed in and a batch has gone
out, to stop sending it.

## Server-side events and users

### `track`

Events your server emits, trusted as given:

```ts
await analytics.track({
  name: "subscription_renewed",
  userId: "user_123",
  props: { plan: "pro" },
  id: invoiceEventId,        // optional; makes retries idempotent
  ts: invoice.paidAt,        // optional; number (ms), Date or ISO string; default now
});
```

`track` takes one event or an array. Fields: `name`, `id`, `userId`,
`anonymousId`, `sessionId`, `path`, `props`, `ts`. Events are stored with
platform `server` and validated like client events; it resolves to
`{ received, inserted, rejected, duplicates }`. `track` does not create or
update a users row.

### `identify`

```ts
await analytics.identify("user_123", {
  createdAt: user.createdAt,          // your sign-up time
  traits: { plan: "free" },
  platform: "ios",
  appVersion: "1.4.0",
});

await analytics.identify("staff_7", { excluded: true });
```

- `createdAt` moves `first_seen_at` earlier, never later. Without it,
  `first_seen_at` is the server time of the first write for that user (an
  ingested batch with that user resolved, or `identify`). Pass it when you
  install the package into an app with existing users, so sign-up cohorts are
  right.
- `traits` are merged key by key into the stored traits.
- `excluded: true` keeps the user out of every metric (staff, test and review
  accounts); `false` puts them back; omitted leaves it as it was.
- `acquisition` (a `WireAcquisition`), `platform` and `appVersion` fill the
  user's first-touch fields only where they are still empty; `platform` decides
  the default channel.

`identify` does not move `last_seen_at`; only ingested activity does.

## Revenue

`recordRevenueEvents(rows)` appends rows to the money ledger and resolves to how
many were new. It is idempotent on `(app_id, provider, providerEventId,
eventType)`, so a redelivered webhook writes nothing. Every row is validated
before any is written; a bad row throws.

| Field | Meaning |
|---|---|
| `userId` | Your user id, or null |
| `provider`, `providerEventId`, `eventType` | Required. `eventType` is the normalized type, one of the list below |
| `providerEventType`, `providerSubscriptionId`, `productId`, `store`, `periodType`, `renewalNumber`, `cancelReason` | Optional context |
| `periodStart`, `periodEnd` | The paid period (ms or `Date`). Drive MRR |
| `amountCents` | Integer: positive when paid, negative on a refund, 0 on a trial start, null on a state-only row |
| `currency` | Stored lowercased |
| `environment` | Default `production`; only `production` rows count in any report |
| `occurredAt` | Required (ms or `Date`) |
| `payload` | The raw provider event, for your own queries |

Normalized event types: `trial_started`, `trial_converted`, `purchased`,
`renewed`, `cancel_scheduled`, `uncanceled`, `expired`, `billing_issue`,
`refunded`, `refund_reversed`, `product_changed`, `reactivated`.

Which rows count toward MRR: a paid row (`purchased`, `trial_converted`,
`renewed`) with a `providerSubscriptionId` **and** a `periodEnd`. A paid row
missing either is a one-time purchase: it counts toward revenue, never MRR.
`sum(amount_cents)` is net revenue. Amounts are summed as recorded; there is no
currency conversion.

### From `@mrmeg/expo-purchases`

`buildLedgerRows` output is assignable to `RevenueEventInput`, but its rows carry
no period. Add the period from the parsed webhook event, or every RevenueCat
subscription reads as a one-time purchase and MRR stays 0:

```ts
import { buildLedgerRows, parseRevenueCatWebhook } from "@mrmeg/expo-purchases/server";

const event = parseRevenueCatWebhook(body);
if (event) {
  const rows = buildLedgerRows(event, { userId }).map((row) => ({
    ...row,
    periodStart: event.purchasedAtMs,
    periodEnd: event.expirationAtMs,
  }));
  await analytics.recordRevenueEvents(rows);
}
```

RevenueCat reports `amountCents` in USD for every store.

### From a Stripe payment

Build the row by hand. Stripe timestamps are seconds; the ledger takes
milliseconds. Where a field lives on the invoice depends on your Stripe API
version; the values below are the ones that matter.

```ts
// invoice.paid
const invoice = stripeEvent.data.object;
const line = invoice.lines.data[0];
await analytics.recordRevenueEvents([
  {
    userId,                                        // your user for this customer
    provider: "stripe",
    eventType: isFirstInvoice ? "purchased" : "renewed",
    providerEventId: stripeEvent.id,
    providerEventType: stripeEvent.type,
    providerSubscriptionId: subscriptionId,        // the invoice's subscription
    productId: priceId,
    store: "stripe",
    periodStart: line.period.start * 1000,
    periodEnd: line.period.end * 1000,
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    environment: stripeEvent.livemode ? "production" : "sandbox",
    occurredAt: stripeEvent.created * 1000,
  },
]);
```

A one-time Checkout payment is the same row with no `providerSubscriptionId`
and no period. A refund is a `refunded` row with a negative `amountCents`.

## Tracked links

One link per channel (a social profile, a newsletter) that records a click and
sends the visitor where their device can install or open the app.

```ts
createAnalyticsServer({
  // ...
  links: {
    web: "https://example.com/sign-up",
    ios: "https://apps.apple.com/app/id123456789",
    android: "https://play.google.com/store/apps/details?id=com.example",
    appleCampaignToken: "123456",          // App Store Connect provider token (pt)
  },
});
```

`GET <basePath>/go/:channel?c=<campaign>`, for example
`https://example.com/analytics/go/tiktok?c=spring`, answers 302:

- iPhone, iPad, iPod with `ios` set: the App Store URL, plus `pt` and `ct`
  (`<channel>` or `<channel>-<campaign>`, cut to 40 characters) when
  `appleCampaignToken` is set. Apple ignores `ct` without `pt`.
- Android with `android` set: the Play URL with `referrer` set to a UTM query
  string (`utm_source=<channel>`, `utm_medium=social` for social channels,
  `utm_campaign=<campaign>`). The package does not read the Play Install
  Referrer in the app; pass what you read to `setAcquisition`.
- Everything else: `web` with the same UTM parameters and `link_click=<click id>`.
  The web tracker reads `link_click` into `acquisition.link_click_id`, which ties a
  later web sign-up to the click.

`channel` must match `^[a-z0-9_-]{1,32}$` and `c` `^[a-z0-9_-]{1,64}$`; anything
else answers 404, as does every `/go/` path when `links` is not configured.
Social channels (`utm_medium=social`) default to `tiktok`, `instagram`,
`facebook`, `youtube`, `x`, `linkedin`, `reddit`, `threads`, `pinterest`;
override with `socialChannels`. A click is recorded for `GET` only and never for
a crawler (`HEAD` is a link checker, a bot is a preview card). Clicks are
anonymous; the acquisition report shows them beside the sign-ups of the same
channel.

## Metric definitions

These are the definitions the reports compute; check numbers against them.

Conventions. Days are calendar dates cut in `metrics.timezone` (default UTC).
A range is inclusive `from` to `to` (`YYYY-MM-DD`); the default is the 30 days
ending today in that zone; at most 400 days. Money is integer cents. A rate is a
`RateCell`: `{ numerator, denominator, rate, status }`, where `status` is
`measured` (rate is numerator over denominator), `not_yet` (the window has not
closed, rate null) or `empty` (no denominator, rate null).

**Population.** A user with `excluded = true` is left out of every figure,
together with their events, the events of devices stitched to them, their
sessions and their revenue.

**Actor and stitching.** An event's actor is its `user_id`, else the user its
`anonymous_id` is stitched to, else the `anonymous_id`. An `anonymous_id` that
appears on any event together with a `user_id` belongs to that user (the one on
the earliest such event if several), so events a device sent before signing in
count toward the user who later signed in on it.

**Activity.** An event in `activeEvents`; by default every event except
`$session_end`.

| Metric | Definition |
|---|---|
| DAU, WAU, MAU | Distinct actors with activity on the day, in the 7 days ending on it, in the 30 days ending on it. One point per day of the range; the headline is the range's last day. |
| Signed-in vs all | Two variants of every active-user figure. `signed_in`: distinct `user_id` on events that carried one. `all`: distinct actors, which includes anonymous devices. A cookieless web visitor gets a new id each UTC day, so in `all` one such visitor active on several days counts once per day in WAU and MAU. |
| Stickiness | Average DAU over the range divided by MAU on the range's last day. |
| New users | Users whose `first_seen_at` falls in the range. `first_seen_at` is the server time the user was first written (an ingested batch with that user resolved, or `identify`), moved earlier by `identify`'s `createdAt`. New users, activation and retention all cohort on it. |
| Activation | Of users first seen in the range, those with the activation event (theirs, or from a device stitched to them, including before sign-up) no later than `withinDays` after `first_seen_at`. A user not yet activated whose window (`first_seen_at + withinDays`) is still open at report time is pending: counted in `pending` and left out of the denominator. Rate: `activated / (signups - pending)`. Null when `activation` is not configured. |
| Retention, modes | Cohort: users first seen on a day; that day is day 0. Activity counts directly or through a stitched device. For day N: `on` is active on exactly day N; `on_or_after` is active on day N or any later day up to today; `bracket` is active on any day in [N, N + 6]. The headline uses `on` for N under 7 and `bracket` from N = 7, unless the request passes `mode`. |
| Retention, maturity | A window has closed once its last day is before today in the zone; an `on_or_after` window counts as closed once day N is over, though its value can still rise. A daily cohort cell is `not_yet` until the window has closed for the cohort's youngest member. The headline instead leaves users whose window is still open out of the denominator and reports them as `pending`, so a range ending today still has a measured headline. |
| Retention, weekly grid | The last 12 ISO-week cohorts (Monday start), ending with the week containing the range end and clipped to it, by weeks 0 to 12, where week w is active on any day in [7w, 7w + 6] after first seen. |
| Funnels | Ordered steps; other events may occur between them. An actor enters at their first step-1 event inside the range, and the window (`windowDays`, default 7, inclusive of its last instant) starts there. The actor counts at step k when they did steps 1..k in that order inside the window; each step takes the earliest qualifying event after the previous one. Per step: actors, conversion from step 1, conversion from the previous step, and the median seconds from the previous step. `open`: actors who have not finished and whose window is still open now. |
| Acquisition channel | Per user, from first-touch fields: `normalizeChannel(utm_source)`, else `normalizeChannel(self_reported_source)`, else the sign-up platform's default (`web_direct`, `app_store_organic`, `play_store_organic`), else `unknown`. Normalizing lowercases, trims, strips `www.`, folds aliases (`tt`, `tiktok.com` to `tiktok`; `ig` to `instagram`; `fb`, `meta` to `facebook`; `yt`, `youtu.be` to `youtube`; `twitter`, `t.co` to `x`, and others in `CHANNEL_ALIASES`), and otherwise turns runs of anything outside `[a-z0-9_-]` into one underscore, cut to 32 characters. A field already set is never overwritten; the channel is recomputed from the merged row on every write. The referrer is stored but does not decide the channel. |
| Acquisition report | Sign-ups (users first seen in the range) by channel and by sign-up platform; link clicks in the range by channel; and per channel, of its sign-ups: activated (when configured), `trial_started` (a production `trial_started` ledger row for the user at any time up to now) and `paid` (a production `purchased`, `trial_converted` or `renewed` row). |
| Web visitors, visits | From web sessions only (`platform = 'web'`) started in the range, placed on the day they started. Visitors: distinct `anonymous_id` over the range. Visits: sessions. A session ends after 30 minutes without an event; a cookieless visitor's events join their latest session while within that gap of it. A cookieless id changes every UTC day, so over a multi-day range a returning cookieless visitor counts once per day they came, and a visit that crosses UTC midnight splits into two sessions. With `persist: true` the id is stable across days. |
| Pageviews | The sum of the sessions' view counts (`$pageview` and `$screen` events). The pages list counts `$pageview` events by `path`. Views per visit: pageviews over visits. |
| Bounce rate | Sessions with at most one pageview and no custom events (events whose name does not start with `$`), over sessions. |
| Visit duration | Mean of `last_seen_at - started_at` per session; a one-event visit is 0 seconds. |
| Breakdowns | Pages, entry and exit pages, referrers (host only; none is `Direct`), UTM sources and campaigns (untagged sessions left out), devices, browsers, OS, countries. Top 20 of each by visitors, then pageviews. Device: a user agent that says mobile or tablet is trusted; otherwise the viewport width decides (under 768 mobile, under 1024 tablet, else desktop). |
| Subscription state | A replay of one `providerSubscriptionId`'s rows up to an instant, by time and then type. `trial_started` opens a trial; a paid row with a `periodEnd` makes it paying for that period; `expired` and `refunded` end it, and `refund_reversed` restores what a refund ended; `cancel_scheduled`, `uncanceled`, `billing_issue`, `product_changed` and `reactivated` change nothing on their own. A paying subscription stays active until 2 days after its paid period ends (so a late renewal is not churn); a trial until its `periodEnd` plus 2 days, or 14 days after its start without one. |
| MRR | For each subscription active and paid at the instant, its latest paid `amountCents` normalized to one month by its period length (`periodStart` to `periodEnd`, or `occurredAt` to `periodEnd` without a start): 6 to 8 days is weekly (×52/12), 27.5 to 31.5 monthly (×1), 85 to 95 quarterly (÷3), 175 to 190 half-yearly (÷6), 360 to 370 yearly (÷12), anything else prorated by days over 365.25/12. Rounded to whole cents per subscription. Reported at the end of the range's last day, at the start of its first day, and at each month end in the range. |
| MRR movements | Per subscription between range start and end: new (not paying at the start, paying at the end), churned (the reverse), expansion and contraction (paying at both, MRR rose or fell). `net_new = new + expansion - contraction - churned`, which equals end MRR minus start MRR. |
| Trial conversion | Trials started in the range, converted when the same subscription has a paid row before the trial's window closes (period end plus 2 days, or 14 days after the start). A trial not converted, not expired or refunded, and still inside its window is pending and left out of the denominator. A `trial_started` row with no subscription id counts as a trial that never converts. |
| Churn | Customer churn: subscriptions paying at the range start and not at its end, over subscriptions paying at the start. Revenue churn: churned MRR over MRR at the range start. A subscription that ended and came back inside the range has not churned. |
| Revenue totals | Over production rows that occurred in the range: gross is the sum of positive amounts, refunds the sum of negative amounts as a positive number, net is gross minus refunds; counts per event type; `cancel_scheduled` rows by `cancelReason` (`unknown` when null). Gross of store and processor fees. |
| Overview | Active users on the last day, new users, web visitors and pageviews, MRR, active paid subscriptions, gross and net revenue, each next to the immediately preceding period of equal length; headline retention for the current period only. |

Each report carries `notes`, the caveats that apply to it, written for display.

## Privacy

Stored, per event: name, time, path (query string and fragment removed), props
as sent, platform, app version, the host's user id if `resolveUserId` returned
one, and an anonymous id and session id. Per session: entry and exit path,
counts, referrer host, UTM tags, coarse device class, browser name, OS name and
country. Per user: what `identify` and first-touch acquisition gave it.

Never stored:

- Raw IP addresses. The IP is used only inside the cookieless visitor hash.
- User agents. Each one is reduced to a device class, browser name and OS name,
  and requests from crawlers, headless browsers and HTTP libraries are answered
  with success and nothing kept.
- Full referrer URLs. Only the host is kept, and a same-site referrer not at all.

Cookieless visitor ids: `sha256(daily salt, app id, IP, user agent)`, cut to 32
hex characters. The salt is random and created per UTC day in
`analytics_salts`; each time the server reads the day's salt, and each time
`prune` runs, it deletes every earlier salt. An id therefore links one visitor
within a day and
never across days, and once a salt is gone nobody can test an IP and user agent
against that day's ids.

What goes in `props`, traits and `path` is yours: do not put email addresses,
names or tokens there.

`prune` deletes old events and sessions; users and revenue rows are kept:

```ts
await analytics.prune({ olderThanDays: 400 });   // { events, sessions }
```

To keep a person out of the figures without deleting anything, `identify` them
with `excluded: true`. To erase one person, delete the rows with their `user_id`
from the events, sessions, users and revenue tables yourself; there is no
built-in erase call.

## Dashboard and query API

Open `<basePath>` (by default `https://your-app/analytics`) as a user `isAdmin`
accepts. The page loads its script and styles from
`<basePath>/assets/dashboard.js` and `dashboard.css` (so a strict
`script-src 'self'; style-src 'self'` policy allows them) and reads the query
API below. Every response is `Cache-Control: no-store`.

| Route | Returns |
|---|---|
| `GET /api/meta` | `appId`, `basePath`, `timezone`, `today`, install state, activation, whether links are configured, funnels, `retentionDays` |
| `GET /api/overview` | `OverviewReport` |
| `GET /api/product` | `ProductReport` |
| `GET /api/retention` | `RetentionReport`; `?mode=on\|on_or_after\|bracket` overrides the headline mode |
| `GET /api/funnels` | `FunnelReport`; `?key=` for one funnel |
| `GET /api/acquisition` | `AcquisitionReport` |
| `GET /api/web` | `WebReport` |
| `GET /api/revenue` | `RevenueReport` |
| `GET /api/events` | `EventPage`: raw events newest first. `?name=`, `?user=`, `?limit=` (default 100, at most 1000), `?before=` (the previous page's `next_before`). As CSV it is one page (default 1000 rows) and the `X-Next-Before` response header carries the cursor when older events remain |

Every report and `/api/events` take `?from=YYYY-MM-DD&to=YYYY-MM-DD`, and
`?format=csv` for a CSV download instead of JSON (UTF-8 with a byte order mark,
CRLF line ends; a text cell starting with `=`, `+`, `-`, `@`, tab or CR is
prefixed with `'` so a spreadsheet does not evaluate it). A report with several
tables takes `?table=`:

| Report | `table` (first is the default) |
|---|---|
| overview | `figures` |
| product | `daily` |
| retention | `weekly`, `daily`, `headline` |
| funnels | `steps` |
| acquisition | `channels`, `platforms`, `link_clicks` |
| web | `daily`, `totals`, `breakdowns`, or one breakdown (`pages`, `entry_pages`, `exit_pages`, `referrers`, `utm_sources`, `utm_campaigns`, `devices`, `browsers`, `os`, `countries`) |
| revenue | `summary`, `mrr`, `event_counts`, `cancellations` |

Status codes: 400 `{ error }` for a bad range, option, format or table; 404 for
anyone `isAdmin` refuses; 409 `{ error: "not_installed", installed, version,
latest, pending }` while the tables are missing or a migration is pending.

From your own code, `analytics.metrics` returns the same reports without HTTP:

```ts
const overview = await analytics.metrics.overview({ from: "2026-01-01", to: "2026-01-31" });
const retention = await analytics.metrics.retention(undefined, { mode: "bracket" });
const onboarding = await analytics.metrics.funnels(undefined, { key: "onboarding" });
const page = await analytics.metrics.events({ name: "signup_completed", limit: 50 });
```

`overview`, `product`, `acquisition`, `web` and `revenue` take an optional range;
`retention` and `funnels` a range and options; `events` its parameters. Each
throws `MetricsInputError` for a range or option it cannot serve.
`@mrmeg/expo-analytics/metrics` has the report types and `formatRateCell`,
`formatCents`, `formatCount`, `formatDuration`, `formatPercent` and
`relativeChange` for rendering them.

## Operations

**Status.** `await analytics.status()` (or `npx expo-analytics status`) reports
`installed`, `version`, `latest`, `pending` migrations and the tables present.

**Upgrades.** A release that changes the tables adds a migration. Call
`install()` on boot (or run `expo-analytics install` in your deploy step) and it
applies the pending ones in one transaction. Until then, the reports answer 409
`not_installed` with the pending versions.

**Retention of raw data.** Schedule `prune({ olderThanDays })` if you want a
limit; nothing is deleted otherwise, apart from expired salts.

**Querying the tables yourself.** Bind array or object parameters as one JSON
string cast `$1::text::jsonb`, never a bare `$1::jsonb`: postgres.js encodes a
string parameter the server types as `jsonb` a second time, and the value
arrives as a JSON string scalar.

### Developing this package

In this repository, `bun run pkg analytics <typecheck|test|build|pack|consumer-smoke|release>`
runs the package tasks. The database suites (`*.db.test.ts`) skip unless
`ANALYTICS_TEST_DATABASE_URL` points at a Postgres whose host is loopback and
whose database name contains `test`; each suite works in its own throwaway
schema and drops it afterwards.

```bash
createdb analytics_test
ANALYTICS_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/analytics_test \
  bun run --cwd packages/analytics test:db
```

`test:db` runs only the database suites and sets `REQUIRE_TEST_DB=1`, which
turns a missing URL into a failure instead of a skip; CI runs them the same way
inside `bun run verify`.

A seeded local demo of the server and dashboard (repository only, not in the
npm package):

```bash
ANALYTICS_DEMO_DATABASE_URL=postgres://postgres@127.0.0.1:5432/analytics_demo \
  bun packages/analytics/examples/demo-server.ts
```

## License

MIT
