# @mrmeg/expo-analytics Full Contract

Package-owned: the trackers, the wire format, the ingest endpoint, seven
installable tables and their migrations, sessions and cookieless visitor ids,
first-touch acquisition and channel resolution, the revenue ledger, tracked
links, every report and its definitions, the query API and the dashboard.
App-owned: the Postgres database and driver, auth (`resolveUserId`, `isAdmin`),
the event names and their props, consent, calling `identify` with sign-up dates
and exclusions, feeding revenue rows from its payment providers, and pruning
policy. Nothing is sent anywhere but the host's own endpoint.

Entrypoints: `.` (core tracker, wire contract), `/web`, `/native`, `/metrics`,
`/server`. Bin: `expo-analytics`.

## Trackers

`createTracker<Events>(options)` (`.`), `createWebTracker<Events>(options,
environment?)` (`/web`), `createNativeTracker<Events>(options)` (`/native`).
`Events` is a `type` alias map of event name to props type alias or
`undefined`.

Shared options: `endpoint` (URL of `POST <basePath>/e`), `appVersion?`,
`headers?: () => Record<string,string> | Promise<…>`, `transport?` (default
`fetch`), `storage?` (AsyncStorage-compatible; core and native), `storageKey?`
(`"expo-analytics"`), `flushIntervalMs?` (30000), `flushAt?` (20), `maxQueue?`
(1000), `enabled?` (true), `now?`, `generateId?`, `onError?`. Core also takes
`platform` (`ios | android | web | server`) and `identify?` (true; false is
cookieless).

Web adds `persist?` (false; true keeps an anonymous id and 30-minute idle
sessions in localStorage), `autoPageviews?` (true), `linkClickParam?`
(`"link_click"`), `respectDoNotTrack?` (false). Without a browser it returns an
inert tracker. Native adds `platform?` (from `Platform.OS`) and
`sessionIdleMs?` (30 minutes); it always sends an anonymous id and session ids.

`Tracker`: `track(name, props?)`, `screen(name, props?)` (`$screen`, sets the
path), `page(path, props?)` (`$pageview`), `startSession()`, `endSession()`,
`setAcquisition(partial)` (first touch: set fields are kept),
`clearAcquisition()`, `flush({ keepalive? })`, `setEnabled(enabled)`, `reset()`
(ends the session, clears acquisition, flushes; keeps the anonymous id),
`shutdown()`. Web and native trackers add `destroy()`. No method throws.

Delivery: batches of at most 100; 2xx removes them, 4xx other than 408 and 429
drops them, anything else retries with backoff from 1 s doubling to 5 min.

## Wire

`WireBatch { context?, acquisition?, events }`. `WireEvent { id (UUID), name,
ts (ISO), session_id?, path?, props? }`. `WireContext { platform?,
app_version?, anonymous_id?, referrer?, screen_width? }`. `WireAcquisition {
utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
landing_path, click_id, click_id_kind (fbclid | gclid | ttclid | msclkid |
link), link_click_id, self_reported_source }`, all optional. No user id field.

`LIMITS`: name 64, path 512, ids 64, props 4096 bytes and 50 keys (larger
props become `{ _truncated: true }`), 100 events and 1 MiB per batch, client
time accepted from 30 days back to 5 minutes ahead (else server time), session
idle 30 minutes. `EVENT_NAME_PATTERN` `^\$?[a-z][a-z0-9_]*$`; unknown `$` names
are rejected. Response: `{ received, inserted, rejected, duplicates }`.

## Server

`createAnalyticsServer(config)` → `AnalyticsServer`. Config: `sql`
(`SqlClient`), `appId` (`[A-Za-z0-9._:-]{1,64}`), `schema?`, `prefix?`
(`analytics_`), `basePath?` (`/analytics`), `resolveUserId?`, `isAdmin?`
(default closed), `allowedOrigins?` (none, or `"*"`), `clientIp?`
(x-forwarded-for, then x-real-ip), `country?` (cf-ipcountry), `links?`,
`metrics?`, `now?`, `onError?`.

`MetricsConfig`: `timezone` (UTC), `activation { event, withinDays (7) }`,
`activeEvents` (all but `$session_end`), `retentionDays` ([1, 7, 30, 90]),
`funnels [{ key, name, steps, windowDays (7) }]`.

Methods: `handle(request)` → `Response | null` (null outside `basePath`; never
throws), `install()`, `uninstall({ cascade? })`, `status()`, `track(event |
events)`, `identify(userId, { createdAt?, traits?, excluded?, acquisition?,
platform?, appVersion? })`, `recordRevenueEvents(rows)` → new row count,
`recordLinkClick(input)`, `prune({ olderThanDays })` → `{ events, sessions }`,
`metrics.{overview, product, retention, funnels, acquisition, web, revenue,
events}`. `toNodeHandler(server)` is Express/Connect middleware.

Adapters: `fromPostgresJs(postgres(url))`, `fromPg(new Pool(...))`. Every query
uses positional parameters; arrays and objects travel as one JSON string cast
`$n::text::jsonb`.

Routes under `basePath`: public `POST /e`, `OPTIONS /e`, `GET|HEAD
/go/:channel?c=` (only with `links`); admin (404 unless `isAdmin`) `GET /`,
`GET /assets/dashboard.js`, `GET /assets/dashboard.css`, `GET /api/meta`, `GET
/api/{overview,product,retention,funnels,acquisition,web,revenue}?from&to`
(`mode` for retention, `key` for funnels), `GET
/api/events?from&to&name&user&limit&before`; each report and events take
`format=csv` and, where a report has several tables, `table=`. 409
`{ error: "not_installed" }` before install or with a migration pending.

## Tables

`<prefix>migrations`, `events`, `sessions`, `users`, `link_clicks`,
`revenue_events`, `salts`, unqualified (the connection's `search_path`) or in
`schema`. Every row carries `app_id`. `user_id` is text with no foreign key.
`users.first_seen_at` is the cohort date (first write, or `identify`'s earlier
`createdAt`); `users.excluded` removes a user, their events and stitched
devices, sessions and revenue from every report; `users.channel` is resolved
from first-touch `utm_source`, then `self_reported_source`, then the sign-up
platform (`web_direct`, `app_store_organic`, `play_store_organic`), then
`unknown`.

`revenue_events` is unique on `(app_id, provider, provider_event_id,
event_type)`. Event types: `trial_started`, `trial_converted`, `purchased`,
`renewed`, `cancel_scheduled`, `uncanceled`, `expired`, `billing_issue`,
`refunded`, `refund_reversed`, `product_changed`, `reactivated`. Paid types:
`purchased`, `trial_converted`, `renewed`. MRR needs a subscription id and a
period end; only `production` rows count.

## Metrics

Pure functions in `/metrics` compute every figure from rows the server fetches:
`computeActiveUsers`, `computeRetention` (and its headline, daily and weekly
parts), `computeFunnel`, `computeChannelFunnel`, `computeWebTotals`,
`indexLedger`, `replaySubscription`, `revenueSnapshot`, `monthlyAmount`,
`mrrMovements`, `computeChurn`, `computeTrialConversion`,
`summarizeRevenueTotals`. Helpers: `resolveDateRange(params, today)`,
`resolveMetricsConfig`, `rateCell`, `toCsv(rows, columns)`, the `format*`
functions, date helpers. Rates are `RateCell { numerator, denominator, rate,
status: measured | not_yet | empty }`. The definitions are in the README.
